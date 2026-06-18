"use server"

import { createHash } from "crypto"
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { checkRateLimit } from "@/lib/admin/rate-limit"
import { recomposeBrief, refreshDocket } from "@/lib/services-client"
import { db } from "@/db/client"
import { adminActions, jobs, entitlements, subscriptions, users, userProfiles, dockets, filings, userDockets } from "@/db/schema"
import { TIER_ENTITLEMENTS, type Tier } from "@/lib/tiers"
import { jurisdictionsForMarkets } from "@/app/(app)/dashboard/queries"
import type { Result } from "@/lib/types"
import type { Market } from "./markets"

export interface TriggerRecomposeArgs {
  userId: string
  briefDate: string
}

export interface TriggerRecomposeResult {
  jobId: string
  status: "queued" | "already_queued"
}

export async function triggerRecompose(
  args: TriggerRecomposeArgs,
): Promise<Result<TriggerRecomposeResult>> {
  const admin = await requireAdmin()
  if (!admin.ok) return { ok: false, error: "Unauthorized" }

  const rl = checkRateLimit(admin.email)
  if (!rl.ok) {
    return { ok: false, error: `Rate limited. Retry in ${Math.ceil(rl.retryAfterMs / 1000)}s.` }
  }

  const actorHash = createHash("sha256").update(admin.email).digest("hex")
  const cutoff = new Date(Date.now() - 5_000)

  const [cached] = await db
    .select({ metadata: adminActions.metadata })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.actorEmailHash, actorHash),
        eq(adminActions.action, "admin.recompose_brief"),
        eq(adminActions.targetId, args.userId),
        gte(adminActions.createdAt, cutoff),
      ),
    )
    .limit(1)

  if (cached) {
    const jobId = (cached.metadata as Record<string, unknown>).jobId as string
    return { ok: true, value: { jobId, status: "already_queued" } }
  }

  const idempotencyKey = `recompose:${args.userId}:${args.briefDate}:${Date.now()}`
  const result = await recomposeBrief({
    user_id: args.userId,
    brief_date: args.briefDate,
    idempotency_key: idempotencyKey,
  })

  if (!result.ok) {
    return { ok: false, error: `Services error: ${result.error.kind}` }
  }

  await logAdminAction({
    action: "admin.recompose_brief",
    targetType: "user",
    targetId: args.userId,
    metadata: {
      jobId: result.value.job_id,
      briefDate: args.briefDate,
      idempotencyKey,
    },
  })

  return { ok: true, value: { jobId: result.value.job_id, status: result.value.status } }
}

export interface PollJobStatusResult {
  status: string
  error: string | null
}

export async function pollJobStatus(jobId: string): Promise<Result<PollJobStatusResult>> {
  const admin = await requireAdmin()
  if (!admin.ok) return { ok: false, error: "Unauthorized" }

  const [row] = await db
    .select({ status: jobs.status, error: jobs.error })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1)

  if (!row) return { ok: false, error: "Job not found" }
  return { ok: true, value: { status: row.status, error: row.error ?? null } }
}

// ---------------------------------------------------------------------------
// Grant market_access entitlements (Beta manual onboarding + future add-ons)
// ---------------------------------------------------------------------------

export interface GrantMarketsArgs {
  userId: string
  markets: Market[]
  expiresAt: Date | null  // null = no expiry; set to Beta end date for temporary grants
}

/**
 * Non-destructive market_access grant — one entitlement row per market (fila-por-mercado).
 * Safe to re-run: deletes then re-inserts only the specified market rows.
 * Other entitlement rows (daily_brief, tracked_dockets, …) are untouched.
 *
 * Usage: grant Beta users access to CAISO/PJM before Stripe is wired (#13/#14).
 * At GA, flip BETA_MARKETS_FREE=false + run backfill-tier-entitlements to revoke.
 */
export async function grantMarketAccess(
  args: GrantMarketsArgs,
): Promise<Result<{ granted: string[] }>> {
  const admin = await requireAdmin()
  if (!admin.ok) return { ok: false, error: "Unauthorized" }

  if (args.markets.length === 0) {
    return { ok: false, error: "No markets specified." }
  }

  const features = args.markets.map(m => `market_access:${m}`)

  // Delete-then-insert (idempotent) for the specified markets only.
  await db
    .delete(entitlements)
    .where(
      and(
        eq(entitlements.userId, args.userId),
        inArray(entitlements.feature, features),
      ),
    )

  await db.insert(entitlements).values(
    features.map(feature => ({
      userId:    args.userId,
      feature,
      value:     {},
      expiresAt: args.expiresAt,
      source:    "beta_grandfather" as const,
    })),
  )

  await logAdminAction({
    action:     "admin.grant_market_access",
    targetType: "user",
    targetId:   args.userId,
    metadata:   { markets: args.markets, expiresAt: args.expiresAt },
  })

  return { ok: true, value: { granted: args.markets } }
}

// ---------------------------------------------------------------------------
// Onboard Beta User — 1-click admin flow
// Does 4 things atomically from the admin's perspective:
//   1. Apply full tier entitlements + selected market_access rows (with betaEnd expiry)
//   2. Upsert subscription status=trialing with currentPeriodEnd=betaEnd
//   3. Set email_verified=true (required by get_active_user_ids in services)
//   4. Auto-track top-5 hot dockets for the granted markets
// ---------------------------------------------------------------------------

export interface OnboardBetaUserArgs {
  userId:  string
  markets: Market[]
  tier:    Tier
  betaEnd: string | null  // ISO date string e.g. "2026-12-31"; null = no expiry
}

export async function onboardBetaUser(
  args: OnboardBetaUserArgs,
): Promise<Result<{ tracked: number; briefJobId: string | null }>> {
  const admin = await requireAdmin()
  if (!admin.ok) return { ok: false, error: "Unauthorized" }

  if (args.markets.length === 0) return { ok: false, error: "No markets specified." }

  const betaEndDate = args.betaEnd
    ? new Date(args.betaEnd + "T23:59:59Z")
    : null

  // 1. Entitlements: tier base (no market_access rows) + admin-selected market rows.
  //    Delete-then-insert so re-running is idempotent and cleans up old rows.
  // Base tier rows (daily_brief, tracked_dockets, etc.) tagged source='tier'.
  // Admin-selected market rows tagged source='beta_grandfather' so the webhook
  // recompute never overwrites them when the user eventually gets a Stripe sub.
  const baseRows = TIER_ENTITLEMENTS[args.tier]
    .filter(e => !e.feature.startsWith("market_access:"))
    .map(e => ({ ...e, source: "tier" as const }))
  const marketRows = args.markets.map(m => ({
    feature: `market_access:${m}`,
    value:   {} as Record<string, unknown>,
    source:  "beta_grandfather" as const,
  }))
  const allEntRows = [...baseRows, ...marketRows].map(e => ({
    userId:    args.userId,
    feature:   e.feature,
    value:     e.value,
    expiresAt: betaEndDate,
    source:    e.source,
  }))
  await db.delete(entitlements).where(eq(entitlements.userId, args.userId))
  await db.insert(entitlements).values(allEntRows)

  // 2. Subscription: upsert trialing row (no Stripe IDs required for beta).
  await db
    .insert(subscriptions)
    .values({
      userId:          args.userId,
      status:          "trialing",
      tier:            args.tier,
      currentPeriodEnd: betaEndDate,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        status:          "trialing",
        tier:            args.tier,
        currentPeriodEnd: betaEndDate,
        updatedAt:       new Date(),
      },
    })

  // 3. Email verified — services' get_active_user_ids() gates on email_verified=true.
  //    Silent bug if omitted: sub+entitlements exist but no briefs ever arrive.
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, args.userId))

  // 3.5. Ensure user_profiles row exists — get_user_for_brief() inner-JOINs it.
  //      Users who skip self-serve onboarding never get this row, causing compose-brief
  //      to silently return no_entitlement. ON CONFLICT DO NOTHING preserves any
  //      profile the user already set via self-serve (role, tags, format).
  await db
    .insert(userProfiles)
    .values({ userId: args.userId })
    .onConflictDoNothing()

  // 4. Auto-track top-5 hot dockets for the granted markets.
  //    Uses jurisdictionsForMarkets (correct CAISO→CAISO-FERC mapping, fixes the
  //    JURISDICTION_TO_MARKET bug in autoTrackHotDockets self-serve path).
  //    Errors are non-fatal — admin sees tracked count in result.
  await _trackHotDockets(args.userId, args.markets, TIER_ENTITLEMENTS[args.tier]).catch(err => {
    console.error("[onboardBetaUser] _trackHotDockets failed:", err)
  })

  // 5. Welcome brief — enqueued after entitlements are live so get_user_for_brief() succeeds.
  //    Non-fatal: onboarding is complete even if the enqueue fails.
  const briefDate = new Date().toISOString().slice(0, 10)
  const briefResult = await recomposeBrief({
    user_id: args.userId,
    brief_date: briefDate,
    idempotency_key: `onboard-brief:${args.userId}:${briefDate}`,
  }).catch(err => {
    console.error("[onboardBetaUser] recomposeBrief failed:", err)
    return null
  })
  const briefJobId = briefResult?.ok ? briefResult.value.job_id : null

  const [{ ct }] = await db
    .select({ ct: count() })
    .from(userDockets)
    .where(eq(userDockets.userId, args.userId))

  await logAdminAction({
    action:     "admin.onboard_beta_user",
    targetType: "user",
    targetId:   args.userId,
    metadata:   { markets: args.markets, tier: args.tier, betaEnd: args.betaEnd, trackedDockets: Number(ct), briefJobId },
  })

  return { ok: true, value: { tracked: Number(ct), briefJobId } }
}

async function _trackHotDockets(
  userId: string,
  markets: Market[],
  tierRows: typeof TIER_ENTITLEMENTS[Tier],
): Promise<void> {
  const docketLimitRow = tierRows.find(e => e.feature === "tracked_dockets")
  const docketLimit = (docketLimitRow?.value as { limit: number | null } | undefined)?.limit ?? 0
  if (docketLimit === 0) return

  const [{ ct }] = await db.select({ ct: count() }).from(userDockets).where(eq(userDockets.userId, userId))
  const currentCount = Number(ct)
  const slotsAvailable = docketLimit === null
    ? 5
    : Math.max(0, Math.min(5, docketLimit - currentCount))
  if (slotsAvailable === 0) return

  const jurisdictions = jurisdictionsForMarkets(markets)
  if (jurisdictions.length === 0) return

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const filingCount = sql<number>`count(${filings.id})`

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
  const toTrack = hotDockets.filter(d => !trackedIds.has(d.id)).slice(0, slotsAvailable)
  if (toTrack.length === 0) return

  await db
    .insert(userDockets)
    .values(toTrack.map(d => ({ userId, docketId: d.id })))
    .onConflictDoNothing()

  await Promise.allSettled(
    toTrack.map(d => refreshDocket({ docket_number: d.externalId, user_id: userId }, 2_000))
  )
}
