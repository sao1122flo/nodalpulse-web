"use client"

import { useState } from "react"
import type { DocketParty } from "./queries"

export function KeyParties({ parties }: { parties: DocketParty[] }) {
  const [showAll, setShowAll] = useState(false)

  if (parties.length === 0) return null

  const roled = parties.filter(p => p.role)
  // Default view: the parties we could assign a role to (the "key" ones). If we
  // couldn't role anyone, fall back to the first handful so the card isn't empty.
  const collapsed = roled.length > 0 ? roled : parties.slice(0, 6)
  const visible = showAll ? parties : collapsed

  return (
    <div className="flex flex-col gap-2">
      {visible.map(p => (
        <div key={p.name} className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-[var(--np-text-strong)] min-w-0 truncate">
            {p.name}
          </span>
          {p.role && (
            <span className="text-[12px] text-[var(--np-text-muted)] flex-shrink-0">
              {p.role}
            </span>
          )}
        </div>
      ))}
      {!showAll && parties.length > visible.length && (
        <button
          onClick={() => setShowAll(true)}
          className="text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors text-left mt-1 cursor-pointer"
        >
          Show all ({parties.length})
        </button>
      )}
    </div>
  )
}
