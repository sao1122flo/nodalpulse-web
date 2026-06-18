"use client"

import { useState, useCallback } from "react"
import { onboardBetaUser } from "./actions"
import { ALL_MARKETS, ALL_TIERS, BETA_END_ISO, type Market, type TierOption } from "./markets"

interface Props {
  userId: string
}

type State = "idle" | "confirming" | "working" | "done" | "failed"

export function OnboardBetaButton({ userId }: Props) {
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")
  const [selectedMarkets, setSelectedMarkets] = useState<Set<Market>>(new Set(ALL_MARKETS))
  const [tier, setTier] = useState<TierOption>("pro")

  const toggleMarket = (m: Market) =>
    setSelectedMarkets(prev => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })

  const handleOnboard = useCallback(async () => {
    setState("working")
    const result = await onboardBetaUser({
      userId,
      markets: [...selectedMarkets] as Market[],
      tier,
      betaEnd: BETA_END_ISO,
    })
    if (result.ok) {
      const docketStr = `${result.value.tracked} docket${result.value.tracked !== 1 ? "s" : ""}`
      const briefStr = result.value.briefJobId ? " · brief queued" : " · brief skipped"
      setMessage(docketStr + briefStr)
      setState("done")
    } else {
      setMessage(result.error)
      setState("failed")
    }
  }, [userId, selectedMarkets, tier])

  const btnBase = "text-[11px] px-2 py-0.5 rounded border transition-colors"

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirming")}
        className={`${btnBase} border-[var(--np-accent)] text-[var(--np-accent-text)] hover:bg-[var(--np-accent)] hover:text-white`}
      >
        Onboard beta
      </button>
    )
  }

  if (state === "confirming") {
    return (
      <span className="flex items-center gap-1.5 flex-wrap">
        <select
          value={tier}
          onChange={e => setTier(e.target.value as TierOption)}
          className="text-[11px] px-1 py-0.5 rounded border border-[var(--np-border)] bg-[var(--np-surface-elevated)] text-[var(--np-text-body)]"
        >
          {ALL_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {ALL_MARKETS.map(m => (
          <label key={m} className="flex items-center gap-0.5 text-[11px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedMarkets.has(m)}
              onChange={() => toggleMarket(m)}
              className="w-3 h-3"
            />
            {m}
          </label>
        ))}
        <button
          onClick={handleOnboard}
          disabled={selectedMarkets.size === 0}
          className={`${btnBase} bg-[var(--np-accent)] text-white border-transparent disabled:opacity-40`}
        >
          Onboard
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
    return <span className="text-[11px] text-[var(--np-text-muted)] font-mono">onboarding…</span>
  }

  if (state === "done") {
    return (
      <span
        className="text-[11px] text-green-600 font-mono cursor-pointer"
        title={`Tracked: ${message}`}
        onClick={() => setState("idle")}
      >
        onboarded ✓ ({message})
      </span>
    )
  }

  return (
    <span
      className="text-[11px] text-[var(--np-danger)] font-mono cursor-pointer"
      title={message}
      onClick={() => setState("idle")}
    >
      failed ↩
    </span>
  )
}
