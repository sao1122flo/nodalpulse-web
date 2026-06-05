"use server"

import { createHash } from "crypto"
import { and, eq, gte, inArray } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { checkRateLimit } from "@/lib/admin/rate-limit"
import { recomposeBrief } from "@/lib/services-client"
import { db } from "@/db/client"
import { adminActions, jobs, entitlements } from "@/db/schema"
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
