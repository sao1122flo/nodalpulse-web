"use client"

import { useState } from "react"
import type { DocketParty } from "./queries"

// Collapsible reference card. On a docket like 58481 (212 parties) an always-open
// parties list buries the hero action (Ask the record) below the fold. Default
// collapsed to a "Key parties · N ⌄" header so the rail leads with actions; expand
// for the full roster. Roled parties (Applicant / Staff / Intervenors) sort first.
export function KeyParties({ parties }: { parties: DocketParty[] }) {
  const [open, setOpen] = useState(false)

  if (parties.length === 0) return null

  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 cursor-pointer group"
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-[0.06em]">
          Key parties · {parties.length}
        </span>
        <span className="text-[12px] text-[var(--np-text-muted)] group-hover:text-[var(--np-text-body)] transition-colors flex-shrink-0">
          {open ? "Hide ↑" : "Show ↓"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 mt-3">
          {parties.map(p => (
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
        </div>
      )}
    </div>
  )
}
