"use client"

import { useTransition, useState } from "react"
import { trackDocket, untrackDocket } from "./actions"

interface TrackButtonProps {
  docketNumber: string
  isTracked: boolean
}

export function TrackButton({ docketNumber, isTracked: initialTracked }: TrackButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [tracked, setTracked] = useState(initialTracked)
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = tracked
        ? await untrackDocket({ docketNumber })
        : await trackDocket({ docketNumber })
      if (result.ok) {
        setTracked(t => !t)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`
          min-h-11 px-4
          rounded-[var(--np-radius-md)]
          border text-[13px]
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors cursor-pointer whitespace-nowrap
          ${tracked
            ? "border-[var(--np-border-strong)] text-[var(--np-text-strong)]"
            : "border-[var(--np-border)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)]"
          }
        `}
      >
        {isPending ? "…" : tracked ? "Tracking ✓" : "Track docket"}
      </button>
      {error && (
        <p className="text-[var(--np-danger)] text-[11px]">{error}</p>
      )}
    </div>
  )
}
