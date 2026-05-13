"use server"

import { createHash } from "crypto"
import { and, eq, gte } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { checkRateLimit } from "@/lib/admin/rate-limit"
import { refreshExtraction } from "@/lib/services-client"
import { db } from "@/db/client"
import { adminActions, jobs } from "@/db/schema"
import type { Result } from "@/lib/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface TriggerRefreshResult {
  jobId: string
  status: "queued" | "already_queued"
}

export async function triggerRefreshExtraction(
  filingId: string,
): Promise<Result<TriggerRefreshResult>> {
  if (!UUID_RE.test(filingId)) {
    return { ok: false, error: "Invalid filing ID — must be a UUID." }
  }

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
        eq(adminActions.action, "admin.refreshed_extraction"),
        eq(adminActions.targetId, filingId),
        gte(adminActions.createdAt, cutoff),
      ),
    )
    .limit(1)

  if (cached) {
    const jobId = (cached.metadata as Record<string, unknown>).jobId as string
    return { ok: true, value: { jobId, status: "already_queued" } }
  }

  const idempotencyKey = `refresh-extraction:${filingId}:${Date.now()}`
  const result = await refreshExtraction({
    filing_id: filingId,
    idempotency_key: idempotencyKey,
  })

  if (!result.ok) {
    return { ok: false, error: `Services error: ${result.error.kind}` }
  }

  await logAdminAction({
    action: "admin.refreshed_extraction",
    targetType: "filing",
    targetId: filingId,
    metadata: {
      jobId: result.value.job_id,
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
