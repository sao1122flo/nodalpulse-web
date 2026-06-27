"use client"

import { useState } from "react"
import type { RecordDeadline } from "./queries"
import { ReportIssueButton } from "./ReportIssueButton"

const DEADLINE_TYPE_LABELS: Record<string, string> = {
  hearing:          "Hearing",
  compliance:       "Compliance",
  comment_deadline: "Comment",
  rehearing:        "Rehearing",
  effective_date:   "Effective",
  order_effective:  "Effective",
  protest_notice:   "Protest",
  calendar:         "Calendar",
  implementation:   "Implementation",
  balloting:        "Balloting",
  other:            "Deadline",
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
    timeZone: "UTC",
  })
}

function urgencyClass(days: number): string {
  if (days <= 3) return "text-[var(--np-danger)]"
  if (days <= 7) return "text-[var(--np-deadline)]"
  return "text-[var(--np-text-muted)]"
}

function urgencyBg(days: number): string {
  if (days <= 3) return "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)]"
  if (days <= 7) return "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.06)]"
  return "border-[var(--np-border)] bg-[var(--np-surface-elevated)]"
}

const INITIAL = 6

interface Props {
  docketNumber: string
  deadlines:    RecordDeadline[]
}

export function RecordDeadlines({ docketNumber, deadlines }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (deadlines.length === 0) return null

  const visible = expanded ? deadlines : deadlines.slice(0, INITIAL)
  const hidden  = deadlines.length - INITIAL

  return (
    <div className="flex flex-col gap-2">
      {visible.map((dl, i) => {
        const typeLabel = DEADLINE_TYPE_LABELS[dl.type] ?? "Deadline"
        return (
          <div
            key={`${dl.date}:${dl.type}:${i}`}
            className={`flex items-start justify-between gap-4 rounded-[var(--np-radius-md)] border px-4 py-3 ${urgencyBg(dl.daysRemaining)}`}
          >
            {/* Left: countdown + description */}
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

                  {/* Confidence — confirmed vs estimated, visually distinct */}
                  {dl.estimated ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(251,191,36,0.12)] text-[#B45309] border border-[rgba(251,191,36,0.35)]">
                      est.
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(34,197,94,0.10)] text-[var(--np-success)] border border-[rgba(34,197,94,0.30)]">
                      confirmed
                    </span>
                  )}

                  {dl.mentionCount > 1 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)]"
                      title={`Mentioned in ${dl.mentionCount} filings`}
                    >
                      {dl.mentionCount} filings
                    </span>
                  )}
                </div>

                <p className="text-[13px] text-[var(--np-text-body)] leading-snug">
                  {dl.description}
                </p>
              </div>
            </div>

            {/* Right: date + source link + report */}
            <div className="flex-shrink-0 text-right">
              <div className="text-[12px] font-medium text-[var(--np-text-strong)]">
                {formatDate(dl.date)}
              </div>
              {/* link is guaranteed non-null by getDocketDeadlines (data-quality gate) */}
              {dl.link && (
                <a
                  href={dl.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
                >
                  {dl.estimated ? "source →" : "verify →"}
                </a>
              )}
              <div className="mt-0.5">
                <ReportIssueButton
                  docketNumber={docketNumber}
                  section="deadline"
                  detail={`${dl.date} · ${dl.description.slice(0, 80)}`}
                />
              </div>
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
