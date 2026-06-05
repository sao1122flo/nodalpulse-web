"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets, filings, extractions } from "@/db/schema"
import { and, count, eq, desc, sql } from "drizzle-orm"
import type { Result } from "@/lib/types"
import { refreshDocket } from "@/lib/services-client"
import { getEntitlements } from "@/lib/entitlements"

// PUCT source UUID — stable, seeded by services on startup.
const PUCT_SOURCE_ID = "0725032a-239f-475d-bdd5-251adad3ae05"

// Maps source UUIDs to the jurisdiction string used in dockets.jurisdiction and market_access entitlements.
// Extend when additional source IDs are introduced (FERC, PJM, CAISO).
const SOURCE_TO_JURISDICTION: Record<string, string> = {
  [PUCT_SOURCE_ID]: "PUCT",
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

  // Market-access gate — single choke point; controls briefs, auto-track, and dashboard.
  const jurisdiction = SOURCE_TO_JURISDICTION[PUCT_SOURCE_ID]
  if (jurisdiction && !ents.marketAccess.includes(jurisdiction)) {
    return { ok: false, error: "Your plan does not include access to this market. See /pricing for details." }
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

  // Find or create the docket entity (UNIQUE on source_id + external_id)
  let [docketRow] = await db
    .select({ id: dockets.id })
    .from(dockets)
    .where(and(eq(dockets.sourceId, PUCT_SOURCE_ID), eq(dockets.externalId, dn)))
    .limit(1)

  if (!docketRow) {
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
      })
      .onConflictDoNothing()

    const [created] = await db
      .select({ id: dockets.id })
      .from(dockets)
      .where(and(eq(dockets.sourceId, PUCT_SOURCE_ID), eq(dockets.externalId, dn)))
      .limit(1)

    docketRow = created
  }

  if (!docketRow) return { ok: false, error: "Failed to create docket" }

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

  const [docketRow] = await db
    .select({ id: dockets.id })
    .from(dockets)
    .where(and(eq(dockets.sourceId, PUCT_SOURCE_ID), eq(dockets.externalId, dn)))
    .limit(1)

  if (docketRow) {
    await db
      .delete(userDockets)
      .where(
        and(
          eq(userDockets.userId, session.user.id),
          eq(userDockets.docketId, docketRow.id),
        ),
      )
  }

  revalidatePath("/dockets")
  revalidatePath(`/dockets/${dn}`)
  return { ok: true, value: undefined }
}
