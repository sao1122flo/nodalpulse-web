"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { briefs } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { recomposeBrief } from "@/lib/services-client"
import type { Result } from "@/lib/types"

export interface RequestBriefResult {
  jobId: string
  status: "queued" | "already_queued"
}

export async function requestBrief(
  date: string,
): Promise<Result<RequestBriefResult>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  // If any brief row already exists for this user+date, don't enqueue again.
  const [existing] = await db
    .select({ id: briefs.id })
    .from(briefs)
    .where(and(eq(briefs.userId, session.user.id), eq(briefs.date, date)))
    .limit(1)

  if (existing) {
    return { ok: true, value: { jobId: existing.id, status: "already_queued" } }
  }

  const idempotencyKey = `user-brief:${session.user.id}:${date}`
  const result = await recomposeBrief({
    user_id: session.user.id,
    brief_date: date,
    idempotency_key: idempotencyKey,
  })

  if (!result.ok) {
    return { ok: false, error: `Services error: ${result.error.kind}` }
  }

  return {
    ok: true,
    value: { jobId: result.value.job_id, status: result.value.status },
  }
}
