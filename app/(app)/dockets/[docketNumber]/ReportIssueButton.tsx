"use client"

import { useState, useTransition } from "react"
import { reportDocketIssue } from "./actions"

interface Props {
  docketNumber: string
  section:      string
  detail?:      string
}

export function ReportIssueButton({ docketNumber, section, detail }: Props) {
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (done) {
    return (
      <span className="text-[10px] text-[var(--np-text-muted)]" title="Thanks — flagged for review">
        reported ✓
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await reportDocketIssue({ docketNumber, section, detail })
          setDone(true)
        })
      }
      className="text-[10px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] underline decoration-dotted underline-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
      title="Report a data issue with this item"
    >
      {isPending ? "…" : "report issue"}
    </button>
  )
}
