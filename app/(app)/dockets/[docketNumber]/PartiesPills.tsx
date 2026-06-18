"use client"

import { useState } from "react"

const COLLAPSED_MAX = 15

export function PartiesPills({ parties }: { parties: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? parties : parties.slice(0, COLLAPSED_MAX)
  const overflow = parties.length - COLLAPSED_MAX

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map(p => (
        <span
          key={p}
          className="
            inline-flex items-center px-2 py-0.5
            rounded-full text-[11px]
            bg-[var(--np-surface-deep)] text-[var(--np-text-body)]
            border border-[var(--np-border)]
          "
        >
          {p}
        </span>
      ))}
      {!expanded && overflow > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="
            inline-flex items-center px-2 py-0.5
            rounded-full text-[11px]
            text-[var(--np-accent-text)] border border-[var(--np-border)]
            hover:bg-[var(--np-surface-deep)] transition-colors
          "
        >
          Show all ({parties.length})
        </button>
      )}
    </div>
  )
}
