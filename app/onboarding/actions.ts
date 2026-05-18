"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userProfiles, savedSearches, userDockets, briefs, jobs } from "@/db/schema"
import { and, count, eq, sql } from "drizzle-orm"
import { getEntitlements } from "@/lib/entitlements"
import { recomposeBrief } from "@/lib/services-client"
import type { Result } from "@/lib/types"
import type { SavedSearchQuery } from "@/db/schema"

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
// Step 4: saved search CRUD
// ---------------------------------------------------------------------------

export async function createSavedSearch(
  name: string,
  query: SavedSearchQuery,
): Promise<Result<{ id: string }>> {
  const session = await getSession()
  const userId = session.user.id

  const ents = await getEntitlements(userId)
  const limit = ents.savedSearches.limit

  if (limit === 0) {
    return { ok: false, error: "Upgrade to a paid plan to create saved searches." }
  }

  if (limit !== null) {
    const [{ ct }] = await db
      .select({ ct: count() })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
    if (Number(ct) >= limit) {
      return {
        ok: false,
        error: `You've reached your ${limit} saved search limit. Upgrade at /pricing for more.`,
      }
    }
  }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "Search name is required." }

  const [row] = await db
    .insert(savedSearches)
    .values({ userId, name: trimmed, query })
    .onConflictDoNothing()
    .returning({ id: savedSearches.id })

  if (!row) {
    return { ok: false, error: `A saved search named "${trimmed}" already exists.` }
  }

  return { ok: true, value: { id: row.id } }
}

export async function deleteSavedSearch(id: string): Promise<Result<void>> {
  const session = await getSession()
  await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.user.id)))
  return { ok: true, value: undefined }
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
