"use client"

import { useState, useTransition } from "react"
import { Flag } from "lucide-react"
import { reportExtractionIssue } from "@/lib/feedback/actions"
import type { FeedbackItemType } from "@/lib/feedback/ref"

// Shared "report issue" affordance for any extracted item (B4). Writes to the
// unified extraction_feedback store. For deadlines/facts the item STAYS visible
// (hides=false) — flagging must never make a real deadline disappear; it just
// marks it and feeds QA. Idempotent server-side, so a double-click is harmless.
interface Props {
  itemType:          FeedbackItemType
  itemRef:           string
  docketRef?:        string
  reason?:           string
  revalidate?:       string
  initiallyReported?: boolean
}

export function ReportFlagButton({
  itemType,
  itemRef,
  docketRef,
  reason,
  revalidate,
  initiallyReported = false,
}: Props) {
  const [reported, setReported] = useState(initiallyReported)
  const [isPending, startTransition] = useTransition()

  if (reported) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-[var(--np-text-muted)]"
        title="Thanks — flagged for review. The item stays visible."
      >
        <Flag size={10} className="fill-current opacity-60" />
        reported
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await reportExtractionIssue({ itemType, itemRef, docketRef, reason, revalidate })
          if (res.ok) setReported(true)
        })
      }
      className="inline-flex items-center gap-1 text-[10px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors disabled:opacity-50 cursor-pointer"
      title="Report a data issue with this item (it stays visible)"
    >
      <Flag size={10} />
      {isPending ? "…" : "report"}
    </button>
  )
}
