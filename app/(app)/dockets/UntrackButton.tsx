"use client"

import { useTransition } from "react"
import { untrackDocket } from "./actions"

export function UntrackButton({ docketNumber }: { docketNumber: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => { await untrackDocket({ docketNumber }) })
      }
      className="
        h-7 px-3
        rounded-[var(--np-radius-sm)]
        border border-[var(--np-border)]
        text-[var(--np-text-muted)] text-[11px]
        hover:border-[rgba(239,68,68,0.4)] hover:text-[var(--np-danger)]
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-colors cursor-pointer whitespace-nowrap
      "
    >
      {isPending ? "…" : "Untrack"}
    </button>
  )
}
