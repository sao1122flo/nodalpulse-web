"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userProfiles, savedSearches, userDockets, briefs, jobs, dockets, filings } from "@/db/schema"
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { getEntitlements } from "@/lib/entitlements"
import { recomposeBrief, refreshDocket } from "@/lib/services-client"
import type { Result } from "@/lib/types"
import type { SavedSearchQuery } from "@/db/schema"
import {
  createSavedSearch as _createSavedSearch,
  deleteSavedSearch as _deleteSavedSearch,
} from "@/app/(app)/saved-searches/actions"

// Thin async wrappers so onboarding components can import from one place.
// ("use server" files may only export async functions — barrel re-exports are not allowed.)
export async function createSavedSearch(
  name: string,
  query: SavedSearchQuery,
): Promise<Result<{ id: string }>> {
  return _createSavedSearch(name, query)
}

export async function deleteSavedSearch(id: string): Promise<Result<void>> {
  return _deleteSavedSearch(id)
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthenticated")
  return session
}

// ---------------------------------------------------------------------------
// Read onboarding state (called by server component to compute initialStep)
// ---------------------------------------------------------------------------

export interface OnboardingState {
  step: number
  trackedCount: number
  savedSearchList: Array<{ id: string; name: string; query: SavedSearchQuery; notify: boolean }>
  trackedDocketLimit: number | null
  savedSearchLimit: number | null
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const session = await getSession()
  const userId = session.user.id

  const [profileRow, ents, [{ tc }], searchRows] = await Promise.all([
    db
      .select({ onboardingStep: userProfiles.onboardingStep })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1),
    getEntitlements(userId),
    db.select({ tc: count() }).from(userDockets).where(eq(userDockets.userId, userId)),
    db
      .select({ id: savedSearches.id, name: savedSearches.name, query: savedSearches.query, notify: savedSearches.notify })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(savedSearches.createdAt),
  ])

  return {
    step: profileRow[0]?.onboardingStep ?? 0,
    trackedCount: Number(tc),
    savedSearchList: searchRows,
    trackedDocketLimit: ents.trackedDockets.limit,
    savedSearchLimit: ents.savedSearches.limit,
  }
}

// ---------------------------------------------------------------------------
// Step 1: save role
// ---------------------------------------------------------------------------

export async function saveRole(role: string): Promise<void> {
  const session = await getSession()
  await db
    .insert(userProfiles)
    .values({
      userId: session.user.id,
      marketRoles: [role],
      trackedTags: [],
      emailFormat: "html",
      onboardingStep: 1,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        marketRoles: [role],
        onboardingStep: sql`GREATEST(${userProfiles.onboardingStep}, 1)`,
      },
    })
}

// ---------------------------------------------------------------------------
// Step 2: save markets
// ---------------------------------------------------------------------------

// Maps onboarding market-tag values to dockets.jurisdiction strings.
// ERCOT zone tags → PUCT (Texas regulator for ERCOT).
// Market-level tags (future multi-market onboarding) map directly.
const MARKET_TAG_TO_JURISDICTIONS: Record<string, string[]> = {
  // Current ERCOT zone tags (step 2 onboarding)
  all:     ["PUCT"],
  north:   ["PUCT"],
  houston: ["PUCT"],
  west:    ["PUCT"],
  south:   ["PUCT"],
  // Future market-level tags
  PUCT:        ["PUCT"],
  ERCOT:       ["ERCOT"],
  FERC:        ["FERC", "CAISO-FERC", "PJM-FERC"],
  PJM:         ["PJM-FERC"],
  CAISO:       ["CAISO-FERC"],
  "PJM-FERC":  ["PJM-FERC"],
  "CAISO-FERC":["CAISO-FERC"],
}

function resolveJurisdictions(marketTags: string[]): string[] {
  const result = new Set<string>()
  for (const tag of marketTags) {
    for (const j of MARKET_TAG_TO_JURISDICTIONS[tag] ?? []) {
      result.add(j)
    }
  }
  return result.size > 0 ? [...result] : ["PUCT"]  // safe fallback for unknown tags
}

/**
 * Auto-track top-5 most-active dockets for the user's selected markets.
 * Option B wow: populates the dashboard and brief from minute zero without
 * waiting for the user to manually enter docket numbers.
 *
 * marketTags: the raw trackedTags value just saved in saveMarkets().
 * Respects tier limit — stops at (limit - currentCount) slots.
 * Service refresh calls are best-effort (short timeout, errors swallowed).
 */
async function autoTrackHotDockets(userId: string, marketTags: string[]): Promise<void> {
  const [ents, [{ ct }]] = await Promise.all([
    getEntitlements(userId),
    db.select({ ct: count() }).from(userDockets).where(eq(userDockets.userId, userId)),
  ])

  const docketLimit = ents.trackedDockets.limit
  if (docketLimit === 0) return  // free tier — no tracking allowed

  // Intersect requested jurisdictions with entitled markets (#05 TODO closed, #07).
  const jurisdictions = resolveJurisdictions(marketTags)
    .filter(j => ents.marketAccess.includes(j))
  if (jurisdictions.length === 0) return

  const currentCount = Number(ct)
  // Cap auto-track at 5, further bounded by remaining entitlement slots.
  const slotsAvailable = docketLimit === null
    ? 5
    : Math.max(0, Math.min(5, docketLimit - currentCount))
  if (slotsAvailable === 0) return

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const filingCount = sql<number>`count(${filings.id})`

  // Fetch a few extra so we have room to skip already-tracked ones.
  const [hotDockets, alreadyTracked] = await Promise.all([
    db
      .select({ id: dockets.id, externalId: dockets.externalId })
      .from(dockets)
      .innerJoin(filings, eq(filings.docketId, dockets.id))
      .where(and(
        inArray(dockets.jurisdiction, jurisdictions),
        gte(filings.filedAt, thirtyDaysAgo),
      ))
      .groupBy(dockets.id, dockets.externalId)
      .orderBy(desc(filingCount))
      .limit(slotsAvailable + 5),
    db
      .select({ docketId: userDockets.docketId })
      .from(userDockets)
      .where(eq(userDockets.userId, userId)),
  ])

  const trackedIds = new Set(alreadyTracked.map(r => r.docketId))
  const toTrack = hotDockets
    .filter(d => !trackedIds.has(d.id))
    .slice(0, slotsAvailable)

  if (toTrack.length === 0) return

  await db
    .insert(userDockets)
    .values(toTrack.map(d => ({ userId, docketId: d.id })))
    .onConflictDoNothing()

  // Enqueue backfill extraction for each; parallel, short timeout, best-effort.
  await Promise.allSettled(
    toTrack.map(d =>
      refreshDocket({ docket_number: d.externalId, user_id: userId }, 2_000)
    )
  )
}

export async function saveMarkets(markets: string[]): Promise<void> {
  const session = await getSession()
  await db
    .insert(userProfiles)
    .values({
      userId: session.user.id,
      marketRoles: [],
      trackedTags: markets,
      emailFormat: "html",
      onboardingStep: 2,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        trackedTags: markets,
        onboardingStep: sql`GREATEST(${userProfiles.onboardingStep}, 2)`,
      },
    })

  // Auto-track hot dockets so the brief and dashboard have content from day one.
  // Errors are non-fatal — user can always track manually in step 3.
  await autoTrackHotDockets(session.user.id, markets).catch(err => {
    console.error("[saveMarkets] autoTrackHotDockets failed:", err)
  })
}

// ---------------------------------------------------------------------------
// Steps 3 + 4: advance step (dockets "Next/Skip", searches "Next/Skip")
// ---------------------------------------------------------------------------

export async function advanceOnboarding(toStep: number): Promise<void> {
  const session = await getSession()
  await db
    .update(userProfiles)
    .set({ onboardingStep: sql`GREATEST(${userProfiles.onboardingStep}, ${toStep})` })
    .where(eq(userProfiles.userId, session.user.id))
}

// ---------------------------------------------------------------------------
// Step 5: fire first brief
// ---------------------------------------------------------------------------

export async function fireBrief(): Promise<Result<{ jobId: string }>> {
  const session = await getSession()
  const userId = session.user.id
  const briefDate = new Date().toISOString().slice(0, 10)
  const idempotencyKey = `onboarding-${userId}-${briefDate}`

  const result = await recomposeBrief({ user_id: userId, brief_date: briefDate, idempotency_key: idempotencyKey })
  if (!result.ok) {
    console.error("[fireBrief] recomposeBrief failed:", result.error)
    return { ok: false, error: "Failed to enqueue brief. Please try again." }
  }

  return { ok: true, value: { jobId: result.value.job_id } }
}

// ---------------------------------------------------------------------------
// Step 5: poll for brief status
// Brief is "ready" once a row exists in the briefs table for (user, date),
// regardless of send_status — the brief card on /dashboard reads that row.
// ---------------------------------------------------------------------------

export type BriefPollStatus = "pending" | "ready" | "failed"

export async function getBriefStatus(
  briefDate: string,
): Promise<{ status: BriefPollStatus; jobId?: string }> {
  const session = await getSession()
  const userId = session.user.id

  // Check if brief row exists (any send_status)
  const [{ ct }] = await db
    .select({ ct: count() })
    .from(briefs)
    .where(and(eq(briefs.userId, session.user.id), eq(briefs.date, briefDate)))

  if (Number(ct) > 0) {
    return { status: "ready" }
  }

  // Check for failed compose-brief job
  const failedJob = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "compose-brief"),
        eq(jobs.status, "failed"),
        sql`${jobs.payload}->>'user_id' = ${userId}`,
        sql`${jobs.payload}->>'brief_date' = ${briefDate}`,
      )
    )
    .limit(1)

  if (failedJob.length > 0) {
    return { status: "failed", jobId: failedJob[0].id }
  }

  return { status: "pending" }
}
