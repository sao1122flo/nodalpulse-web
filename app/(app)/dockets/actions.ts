"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets, filings, extractions } from "@/db/schema"
import { and, count, eq, desc, sql, isNotNull, inArray } from "drizzle-orm"
import type { Result } from "@/lib/types"
import { refreshDocket } from "@/lib/services-client"
import { getEntitlements } from "@/lib/entitlements"

// PUCT source UUID — stable, seeded by services on startup.
// Only used for creating NEW PUCT dockets that haven't been crawled yet.
const PUCT_SOURCE_ID = "0725032a-239f-475d-bdd5-251adad3ae05"

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
  } else if (/^\d+$/.test(dn)) {
    // Docket not indexed yet — only accept all-digit PUCT control numbers for on-demand creation.
    if (!ents.marketAccess.includes("PUCT")) {
      return { ok: false, error: "Your plan does not include access to this market. See /pricing for details." }
    }

    const [labelRow] = await db
      .select({ title: filings.title })
      .from(extractions)
      .innerJoin(filings, eq(extractions.filingId, filings.id))
      .where(sql`${extractions.payload}->>'docket_number' = ${dn}`)
      .orderBy(desc(filings.filedAt))
      .limit(1)

    await db
      .insert(dockets)
      .values({
        sourceId:   PUCT_SOURCE_ID,
        externalId: dn,
        title:      labelRow?.title ?? null,
        status:     "open",
        jurisdiction: "PUCT",
      })
      .onConflictDoNothing()

    const [created] = await db
      .select({ id: dockets.id })
      .from(dockets)
      .where(and(eq(dockets.sourceId, PUCT_SOURCE_ID), eq(dockets.externalId, dn)))
      .limit(1)

    if (!created) return { ok: false, error: "Failed to create docket" }
    docketRow = created
  } else {
    return {
      ok: false,
      error: "Docket not found in our index. CPUC, FERC, and CAISO dockets populate automatically — try again in a few minutes.",
    }
  }

  await db
    .insert(userDockets)
    .values({ userId: session.user.id, docketId: docketRow.id })
    .onConflictDoNothing()

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
