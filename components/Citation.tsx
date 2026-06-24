"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { QnaCitation } from "@/lib/services-client"

interface Props {
  c: QnaCitation
}

export function Citation({ c }: Props) {
  const [show, setShow] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const router = useRouter()

  const label = c.docket_number ?? c.filing_id.slice(0, 8)

  function openPanel() {
    if (!c.docket_number) return
    const u = new URL(window.location.href)
    u.searchParams.set("docket", c.docket_number)
    router.push(u.pathname + "?" + u.searchParams.toString(), { scroll: false })
  }

  function enter() {
    clearTimeout(hideTimer.current)
    setShow(true)
  }

  function leave() {
    hideTimer.current = setTimeout(() => setShow(false), 120)
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={enter}
        onMouseLeave={leave}
        onClick={openPanel}
        className="inline-flex items-center font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--np-accent-fill)] text-[var(--np-accent-text)] border border-[rgba(99,102,241,0.2)] hover:border-[rgba(99,102,241,0.45)] transition-colors cursor-pointer leading-none"
      >
        {label}
      </button>

      {show && (
        <span
          onMouseEnter={enter}
          onMouseLeave={leave}
          className="absolute bottom-full left-0 mb-1 w-72 rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] shadow-xl p-3 z-[60] flex flex-col gap-2 text-left"
        >
          {c.title && (
            <span className="text-[12px] font-medium text-[var(--np-text-strong)] leading-snug">
              {c.title}
            </span>
          )}
          {c.snippet ? (
            <span className="text-[11px] text-[var(--np-text-body)] leading-relaxed italic border-l-2 border-[var(--np-accent)] pl-2">
              &ldquo;{c.snippet}&rdquo;
              {c.page_number && (
                <span className="not-italic text-[var(--np-text-muted)] ml-1">p.{c.page_number}</span>
              )}
            </span>
          ) : c.relevance_note ? (
            <span className="text-[11px] text-[var(--np-text-muted)] leading-relaxed">
              {c.relevance_note}
            </span>
          ) : null}
          <span className="flex items-center gap-3 pt-0.5 border-t border-[var(--np-border)]">
            {c.source_url && (
              <a
                href={c.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[var(--np-accent-text)] hover:underline"
              >
                Open source →
              </a>
            )}
            {c.docket_number && (
              <button
                type="button"
                onClick={openPanel}
                className="text-[11px] text-[var(--np-accent-text)] hover:underline cursor-pointer"
              >
                Open in panel →
              </button>
            )}
          </span>
        </span>
      )}
    </span>
  )
}
