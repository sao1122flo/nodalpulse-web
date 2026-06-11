"use client"
import { useState } from "react"

export function FilingSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <p className={`text-[var(--np-text-muted)] text-[12px] mt-0.5 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[10px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors mt-0.5 cursor-pointer"
        >
          more ↓
        </button>
      )}
    </div>
  )
}
