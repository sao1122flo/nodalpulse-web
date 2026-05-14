"use client"

import { useTransition, useState } from "react"
import { requestBrief } from "./actions"

export function RequestBriefButton({ date }: { date: string }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleClick() {
    startTransition(async () => {
      const result = await requestBrief(date)
      if (result.ok) {
        setMessage(
          result.value.status === "queued"
            ? "Brief requested — check back in a few minutes."
            : "Brief already in the queue.",
        )
      } else {
        setMessage(`Could not request brief: ${result.error}`)
      }
    })
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || message !== null}
        className="
          h-9 px-5
          rounded-[var(--np-radius-md)]
          border border-[var(--np-border)]
          text-[var(--np-text-body)] text-[13px]
          hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)]
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors cursor-pointer
        "
      >
        {isPending ? "Requesting…" : "Request today's brief"}
      </button>
      {message && (
        <p className="mt-2 text-[var(--np-text-muted)] text-[12px]">{message}</p>
      )}
    </div>
  )
}
