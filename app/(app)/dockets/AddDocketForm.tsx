"use client"

import { useTransition, useState, useRef } from "react"
import { trackDocket } from "./actions"

export function AddDocketForm() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = inputRef.current?.value.trim() ?? ""
    if (!val) return
    setMessage(null)
    startTransition(async () => {
      const result = await trackDocket({ docketNumber: val })
      if (result.ok) {
        if (inputRef.current) inputRef.current.value = ""
        setMessage(
          result.value.warming
            ? "Tracking saved — your filings are warming up, refresh in a minute."
            : "Docket added."
        )
      } else {
        setMessage(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 mb-6">
      <input
        ref={inputRef}
        type="text"
        placeholder="PUCT control number (e.g. 59475)"
        required
        disabled={isPending}
        className="
          h-9 px-3 flex-1 min-w-[200px] max-w-xs
          rounded-[var(--np-radius-md)]
          border border-[var(--np-border)]
          bg-[var(--np-surface-elevated)]
          text-[var(--np-text-body)] text-[13px]
          placeholder:text-[var(--np-text-muted)]
          focus:outline-none focus:border-[var(--np-border-strong)]
          disabled:opacity-40
          transition-colors
        "
      />
      <button
        type="submit"
        disabled={isPending}
        className="
          min-h-[36px] px-4
          rounded-[var(--np-radius-md)]
          border border-[var(--np-border)]
          text-[var(--np-text-body)] text-[13px]
          hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)]
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors cursor-pointer whitespace-nowrap
        "
      >
        {isPending ? "Adding…" : "Track docket"}
      </button>
      {message && (
        <p className="w-full text-[var(--np-text-muted)] text-[12px]">{message}</p>
      )}
    </form>
  )
}
