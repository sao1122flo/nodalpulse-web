"use client"

import { useState, useCallback } from "react"
import { grantMarketAccess, ALL_MARKETS, type Market } from "./actions"

interface Props {
  userId: string
}

type State = "idle" | "confirming" | "working" | "done" | "failed"

export function GrantMarketsButton({ userId }: Props) {
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")
  // Default: grant all markets (full Beta access).
  const [selected, setSelected] = useState<Set<Market>>(new Set(ALL_MARKETS))

  const toggle = (m: Market) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })

  const handleGrant = useCallback(async () => {
    setState("working")
    const result = await grantMarketAccess({
      userId,
      markets: [...selected] as Market[],
      expiresAt: null,
    })
    if (result.ok) {
      setMessage(result.value.granted.join(", "))
      setState("done")
    } else {
      setMessage(result.error)
      setState("failed")
    }
  }, [userId, selected])

  const btnBase =
    "text-[11px] px-2 py-0.5 rounded border transition-colors"

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirming")}
        className={`${btnBase} border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] hover:border-[var(--np-text-muted)]`}
      >
        Grant markets
      </button>
    )
  }

  if (state === "confirming") {
    return (
      <span className="flex items-center gap-1.5 flex-wrap">
        {ALL_MARKETS.map(m => (
          <label key={m} className="flex items-center gap-0.5 text-[11px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.has(m)}
              onChange={() => toggle(m)}
              className="w-3 h-3"
            />
            {m}
          </label>
        ))}
        <button
          onClick={handleGrant}
          disabled={selected.size === 0}
          className={`${btnBase} bg-[var(--np-accent)] text-white border-transparent disabled:opacity-40`}
        >
          Grant
        </button>
        <button
          onClick={() => setState("idle")}
          className={`${btnBase} border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)]`}
        >
          Cancel
        </button>
      </span>
    )
  }

  if (state === "working") {
    return <span className="text-[11px] text-[var(--np-text-muted)] font-mono">granting…</span>
  }

  if (state === "done") {
    return (
      <span className="text-[11px] text-green-600 font-mono" title={`Granted: ${message}`}>
        granted ✓
      </span>
    )
  }

  return (
    <span className="text-[11px] text-[var(--np-danger)] font-mono" title={message}>
      failed
    </span>
  )
}
