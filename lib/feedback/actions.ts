"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { extractionFeedback } from "@/db/schema"
import type { Result } from "@/lib/types"
import type { FeedbackItemType } from "./ref"

// reportExtractionIssue — the single write path for the B4 data-quality store.
// Behavior by type is data-driven via `hides`:
//   - discovery "not relevant" → hides=true  (noise; remove from the feed)
//   - deadline / fact "report issue" → hides=false (flag for QA but KEEP visible —
//     hiding a deadline the user mis-flagged could cause a miss; never do that)
// Idempotent: re-reporting the same item is a no-op (first report wins).
export async function reportExtractionIssue(params: {
  itemType:    FeedbackItemType
  itemRef:     string
  docketRef?:  string
  reason?:     string
  note?:       string
  hides?:      boolean
  revalidate?: string
}): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const itemRef = params.itemRef.trim()
  if (!itemRef) return { ok: false, error: "Missing item" }

  const hides = params.hides ?? params.itemType === "discovery"

  try {
    await db
      .insert(extractionFeedback)
      .values({
        userId:    session.user.id,
        itemType:  params.itemType,
        itemRef,
        docketRef: params.docketRef?.trim() || null,
        reason:    params.reason?.trim() || null,
        note:      params.note?.trim() || null,
        hidesItem: hides,
      })
      .onConflictDoNothing()
  } catch (e) {
    // Don't block the user on a logging failure — but don't swallow silently.
    console.error("[reportExtractionIssue] failed to persist", { itemRef, error: String(e) })
    return { ok: false, error: "Could not record feedback" }
  }

  if (params.revalidate) revalidatePath(params.revalidate)
  return { ok: true, value: undefined }
}
