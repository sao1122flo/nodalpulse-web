"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { adminActions } from "@/db/schema"
import { createHash } from "node:crypto"
import type { Result } from "@/lib/types"

// reportDocketIssue — data-quality "report an issue" affordance (#B1 P0).
// Stub: persists a lightweight audit row so flagged extractions are reviewable,
// and logs server-side. No user-facing workflow yet — surfaced for triage.
export async function reportDocketIssue(params: {
  docketNumber: string
  section:      string
  detail?:      string
}): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const docketNumber = params.docketNumber.trim()
  if (!docketNumber) return { ok: false, error: "Missing docket" }

  const actorEmailHash = createHash("sha256")
    .update(session.user.email.toLowerCase())
    .digest("hex")

  try {
    await db.insert(adminActions).values({
      actorEmailHash,
      action:     "docket_issue_report",
      targetType: "docket",
      targetId:   docketNumber,
      metadata:   {
        section: params.section,
        detail:  params.detail ?? null,
        userId:  session.user.id,
      },
    })
  } catch (e) {
    // Never block the user on a logging failure — but don't swallow silently.
    console.error("[reportDocketIssue] failed to persist", { docketNumber, error: String(e) })
  }

  return { ok: true, value: undefined }
}
