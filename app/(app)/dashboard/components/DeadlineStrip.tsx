"use client"

import { useState } from "react"
import Link from "next/link"
import type { DashboardDeadline } from "../queries"

const DEADLINE_TYPE_LABELS: Record<string, string> = {
  hearing:           "Hearing",
  compliance:        "Compliance",
  comment_deadline:  "Comment",
  rehearing:         "Rehearing",
  effective_date:    "Effective",
  order_effective:   "Effective",
  protest_notice:    "Protest",
  calendar:          "Calendar",
  implementation:    "Implementation",
  balloting:         "Balloting",
  other:             "Deadline",
}

const JURISDICTION_BADGE: Record<string, string> = {
  PUCT:       "PUCT",
  ERCOT:      "ERCOT",
  "CAISO-FERC": "CAISO",
  CAISO:      "CAISO",
  CPUC:       "CPUC",
  "PJM-FERC": "PJM",
  PJM:        "PJM",
  FERC:       "FERC",
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z")
  return d.toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    timeZone: "UTC",
  })
}

function urgencyClass(days: number): string {
  if (days <= 3)  return "text-[var(--np-danger)]"
  if (days <= 7)  return "text-[var(--np-deadline)]"
  return "text-[var(--np-text-muted)]"
}

function urgencyBg(days: number): string {
  if (days <= 3)  return "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)]"
  if (days <= 7)  return "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.06)]"
  return "border-[var(--np-border)] bg-[var(--np-surface-elevated)]"
}

const STRIP_INITIAL = 8

interface Props {
  deadlines: DashboardDeadline[]
}

export function DeadlineStrip({ deadlines }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (deadlines.length === 0) {
    return (
      <div className="text-[var(--np-text-muted)] text-[13px] py-3">
        No upcoming deadlines for tracked matters.
      </div>
    )
  }

  const visible = expanded ? deadlines : deadlines.slice(0, STRIP_INITIAL)
  const hidden  = deadlines.length - STRIP_INITIAL

  return (
    <div className="flex flex-col gap-2">
      {visible.map((dl, i) => {
        const typeLabel = DEADLINE_TYPE_LABELS[dl.type] ?? "Deadline"
        const jurisdictionLabel = dl.jurisdiction
          ? (JURISDICTION_BADGE[dl.jurisdiction] ?? dl.jurisdiction)
          : null
        const docketHref = dl.docketExternalId
          ? `/dockets/${encodeURIComponent(dl.docketExternalId)}`
          : null

        return (
          <div
            key={`${dl.docketId}:${dl.date}:${dl.description}:${i}`}
            className={`
              flex items-start justify-between gap-4
              rounded-[var(--np-radius-md)] border px-4 py-3
              ${urgencyBg(dl.daysRemaining)}
            `}
          >
            {/* Left: day count + description */}
            <div className="flex items-start gap-3 min-w-0">
              <div className={`flex-shrink-0 text-center w-10 ${urgencyClass(dl.daysRemaining)}`}>
                <div className="text-[18px] font-semibold leading-none">{dl.daysRemaining}</div>
                <div className="text-[10px] leading-tight mt-0.5">
                  {dl.daysRemaining === 1 ? "day" : "days"}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-medium text-[var(--np-text-muted)] uppercase tracking-wide">
                    {typeLabel}
                  </span>
                  {jurisdictionLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)]">
                      {jurisdictionLabel}
                    </span>
                  )}
                  {dl.estimated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(251,191,36,0.1)] text-[#92400E] border border-[rgba(251,191,36,0.3)]">
                      est.
                    </span>
                  )}
                  {dl.mentionCount > 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)]">
                      {dl.mentionCount} filings
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[var(--np-text-body)] leading-snug line-clamp-2">
                  {dl.description}
                </p>
                {dl.docketTitle && docketHref && (
                  <Link
                    href={docketHref}
                    className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors mt-0.5 block"
                  >
                    {dl.docketExternalId} — {dl.docketTitle}
                  </Link>
                )}
              </div>
            </div>

            {/* Right: date + verify link */}
            <div className="flex-shrink-0 text-right">
              <div className="text-[12px] font-medium text-[var(--np-text-strong)]">
                {formatDate(dl.date)}
              </div>
              {dl.verifyUrl && (
                <a
                  href={dl.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
                >
                  verify →
                </a>
              )}
            </div>
          </div>
        )
      })}

      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-left text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors pl-1 py-0.5 cursor-pointer"
        >
          + {hidden} more deadline{hidden !== 1 ? "s" : ""} ↓
        </button>
      )}
      {expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="text-left text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors pl-1 py-0.5 cursor-pointer"
        >
          View less ↑
        </button>
      )}
    </div>
  )
}
