"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets } from "@/db/schema"
import { and, count, eq, isNotNull, inArray } from "drizzle-orm"
import type { Result } from "@/lib/types"
import { crawlOnDemand, refreshDocket } from "@/lib/services-client"
import { getEntitlements } from "@/lib/entitlements"

// Source UUIDs for non-PUCT on-demand docket creation (mirrors services sources table).
const NON_PUCT_SOURCE_IDS: Record<string, string> = {
  cpuc: "a584c91a-888d-4ba5-8d2c-8f3101f84db3",
  ferc: "7467c1b9-613c-4379-91d3-10fdabe435c3",
}

// Jurisdiction stamped on new non-PUCT stubs; mirrors _SOURCE_JURISDICTION in services.
const SOURCE_JURISDICTION: Record<string, string> = {
  cpuc: "CPUC",
  ferc: "FERC",
}

// Detect source_slug from a docket number that wasn't found in the DB.
// Returns null for unrecognised formats (rejects before stub creation).
function detectSourceSlug(dn: string): "cpuc" | "ferc" | null {
  const u = dn.toUpperCase().trim()
  if (/^[ARI]\d/.test(u)) return "cpuc"            // CPUC: A2508008, R2502005, I2604008
  if (/^(EL|ER|RM|QF|RP|CP)\d/.test(u)) return "ferc" // FERC/PJM: EL25-49, ER26-1556
  return null
}

// dockets.jurisdiction → market_access entitlement code.
// Mirrors the mapping in dashboard/queries.ts.
const JURISDICTION_TO_MARKET: Record<string, string> = {
  PUCT:        "PUCT",
  ERCOT:       "ERCOT",
  "CAISO-FERC": "CAISO",
  CAISO:       "CAISO",
  CPUC:        "CAISO",
  "PJM-FERC":  "PJM",
  PJM:         "PJM",
  "NJ-BPU":    "PJM",
  "MD-PSC":    "PJM",
  "VA-SCC":    "PJM",
  FERC:        "FERC",
}

export async function trackDocket({
  docketNumber,
}: {
  docketNumber: string
}): Promise<Result<{ warming: boolean }>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const dn = docketNumber.trim()
  if (!dn) return { ok: false, error: "Docket number is required" }
  if (dn.includes(" ")) return { ok: false, error: "Docket number must not contain spaces" }

  // Tier-limit enforcement — applies everywhere trackDocket is called (onboarding + dockets page)
  const ents = await getEntitlements(session.user.id)
  const docketLimit = ents.trackedDockets.limit
  if (docketLimit === 0) {
    return { ok: false, error: "Upgrade to a paid plan to track dockets." }
  }

  if (docketLimit !== null) {
    const [{ ct }] = await db
      .select({ ct: count() })
      .from(userDockets)
      .where(eq(userDockets.userId, session.user.id))
    if (Number(ct) >= docketLimit) {
      return {
        ok: false,
        error: `You've reached your ${docketLimit}-docket limit. Upgrade at /pricing to track more.`,
      }
    }
  }

  // Authoritative lookup: find the docket by external_id from any crawler source.
  // Dockets with jurisdiction = NULL are ghosts from the old PUCT-only path — skip them.
  const [existingDocket] = await db
    .select({ id: dockets.id, jurisdiction: dockets.jurisdiction })
    .from(dockets)
    .where(and(eq(dockets.externalId, dn), isNotNull(dockets.jurisdiction)))
    .limit(1)

  let docketRow: { id: string }

  if (existingDocket) {
    // Docket is already indexed by a crawler — use it and gate on its market.
    const market = JURISDICTION_TO_MARKET[existingDocket.jurisdiction ?? ""] ?? null
    if (!market || !ents.marketAccess.includes(market)) {
      return {
        ok: false,
        error: `Your plan does not include access to this market${market ? ` (${market})` : ""}. See /pricing for details.`,
      }
    }
    docketRow = existingDocket
  } else {
    // Docket not indexed yet → on-demand seed via services (probe + enqueue backfill).
    // All-digit → PUCT control number; otherwise detect CPUC/FERC by format. PUCT now
    // goes through the same on-demand path as CPUC/FERC (previously it only got an empty
    // stub + refresh-docket, which is exactly why a tracked PUCT docket whose filings
    // predate the daily crawl window showed a mute empty page — the 58481/58479 bug).
    const sourceSlug = /^\d+$/.test(dn) ? "puct" : detectSourceSlug(dn)
    if (!sourceSlug) {
      return { ok: false, error: "Unrecognized docket format. Check the number and try again." }
    }

    // Market gate per source.
    if (sourceSlug === "puct") {
      if (!ents.marketAccess.includes("PUCT")) {
        return { ok: false, error: "Your plan does not include access to this market. See /pricing for details." }
      }
    } else if (sourceSlug === "cpuc") {
      if (!ents.marketAccess.includes("CAISO")) {
        return { ok: false, error: "Your plan does not include access to California (CPUC) proceedings. See /pricing for details." }
      }
    } else {
      if (!ents.marketAccess.includes("PJM") && !ents.marketAccess.includes("CAISO")) {
        return { ok: false, error: "Your plan does not include access to FERC/PJM proceedings. See /pricing for details." }
      }
    }

    // Validate inline + enqueue backfill via services. Services probes the source
    // (~1-3 s), creates/finds the docket row, enqueues a parametrized crawl job, and
    // returns the canonical docket_id. For PUCT the job is crawl-puct with
    // control_numbers (skips L1 date-discovery → full history).
    const onDemandResult = await crawlOnDemand(
      { source_slug: sourceSlug, proceeding_id: dn, user_id: session.user.id },
      15_000,
    )

    if (!onDemandResult.ok) {
      const is429 = onDemandResult.error.kind === "unexpected" && onDemandResult.error.status === 429
      if (is429) return { ok: false, error: "You've triggered too many backfills this hour. Try again later." }
      // Network / transient error — do NOT create a stub (would be an unfilled ghost).
      return { ok: false, error: "Couldn't reach the indexer right now. Try again in a moment." }
    }

    if (!onDemandResult.value.valid) {
      return { ok: false, error: `Docket "${dn}" was not found in the ${sourceSlug.toUpperCase()} index. Verify the number and try again.` }
    }

    // Services validated + enqueued the backfill, returned the canonical docket_id.
    docketRow = { id: onDemandResult.value.docket_id }

    await db.insert(userDockets).values({ userId: session.user.id, docketId: docketRow.id }).onConflictDoNothing()
    revalidatePath("/dockets")
    revalidatePath(`/dockets/${dn}`)
    return { ok: true, value: { warming: true } }
  }

  await db
    .insert(userDockets)
    .values({ userId: session.user.id, docketId: docketRow.id })
    .onConflictDoNothing()

  // PUCT path: refresh-docket queues extraction of any already-crawled filings.
  // SERVICES_API_KEY must stay server-side only — never expose to client;
  // client-controlled user_id is advisory, bearer token is the security boundary.
  const warmResult = await refreshDocket(
    { docket_number: dn, user_id: session.user.id },
    3_000,
  )
  if (!warmResult.ok) {
    console.error("[trackDocket] refresh-docket failed", { dn, error: warmResult.error })
  }

  revalidatePath("/dockets")
  revalidatePath(`/dockets/${dn}`)
  return { ok: true, value: { warming: !warmResult.ok } }
}

export async function untrackDocket({
  docketNumber,
}: {
  docketNumber: string
}): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const dn = docketNumber.trim()

  // Look up ALL docket rows for this external_id (any source, including ghosts)
  // so that untrack removes every user_docket pointing to this docket number.
  const allRows = await db
    .select({ id: dockets.id })
    .from(dockets)
    .where(eq(dockets.externalId, dn))

  if (allRows.length > 0) {
    await db
      .delete(userDockets)
      .where(
        and(
          eq(userDockets.userId, session.user.id),
          inArray(userDockets.docketId, allRows.map(r => r.id)),
        ),
      )
  }

  revalidatePath("/dockets")
  revalidatePath(`/dockets/${dn}`)
  return { ok: true, value: undefined }
}
