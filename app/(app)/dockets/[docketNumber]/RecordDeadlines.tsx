"use client"

import { useState } from "react"
import type { RecordDeadline } from "./queries"
import { ConfidenceBadge } from "@/app/(app)/components/ConfidenceBadge"
import { ReportFlagButton } from "@/app/(app)/components/ReportFlagButton"
import { deadlineFeedbackRef } from "@/lib/feedback/ref"

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

// "Vistra, Tract +3 more" — compact party summary for the contested headline.
function partySummary(parties: string[]): string {
  if (parties.length === 0) return "multiple parties"
  if (parties.length <= 2) return parties.join(" and ")
  return `${parties.slice(0, 2).join(", ")} +${parties.length - 2} more`
}

const INITIAL = 6

interface Props {
  docketNumber: string
  deadlines:    RecordDeadline[]
  reportedRefs: string[]
}

function DeadlineRow({
  dl,
  docketNumber,
  reportedSet,
}: {
  dl:          RecordDeadline
  docketNumber: string
  reportedSet:  Set<string>
}) {
  const [showPositions, setShowPositions] = useState(false)
  const typeLabel = DEADLINE_TYPE_LABELS[dl.type] ?? "Deadline"
  const feedbackRef = deadlineFeedbackRef({
    docketExternalId: docketNumber,
    date:             dl.date,
    type:             dl.type,
    description:      dl.description,
  })
  const positions = dl.positions ?? []
  const parties   = dl.parties ?? []

  return (
    <div
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
            {dl.contested ? (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide bg-[rgba(251,191,36,0.14)] text-[var(--np-deadline)] border border-[rgba(251,191,36,0.35)]"
                title="Same date proposed by multiple parties — a contested milestone extracted from the record"
              >
                ⚑ Contested · {positions.length} positions
              </span>
            ) : (
              <>
                <span className="text-[11px] font-medium text-[var(--np-text-muted)] uppercase tracking-wide">
                  {typeLabel}
                </span>
                <ConfidenceBadge estimated={dl.estimated} />
                {dl.mentionCount > 1 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)]"
                    title={`Mentioned in ${dl.mentionCount} filings`}
                  >
                    {dl.mentionCount} filings
                  </span>
                )}
              </>
            )}
          </div>

          <p className="text-[13px] text-[var(--np-text-body)] leading-snug">
            {dl.description}
          </p>

          {dl.contested ? (
            <>
              {/* Reframe: this date is proposed IN the record by parties, not an
                  official calendar date — that distinction is the intelligence. */}
              <p className="text-[11px] text-[var(--np-text-muted)] mt-1 leading-snug">
                Proposed in the record by{" "}
                <span className="text-[var(--np-text-body)]">{partySummary(parties)}</span>
                {" "}— extracted from party filings, not a confirmed calendar date.
              </p>
              <button
                onClick={() => setShowPositions(v => !v)}
                className="mt-1.5 text-[11px] font-medium text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors cursor-pointer"
              >
                {showPositions ? "Hide" : "View"} {positions.length} party position
                {positions.length !== 1 ? "s" : ""} {showPositions ? "↑" : "↓"}
              </button>

              {showPositions && (
                <div className="mt-2 flex flex-col gap-2 border-l-2 border-[var(--np-border)] pl-3">
                  {positions.map((p, i) => (
                    <div key={i} className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <span className="text-[12px] font-medium text-[var(--np-text-strong)]">
                          {p.parties.length ? p.parties.join(", ") : (p.actor ?? "In the record")}
                        </span>
                        {p.mentionCount > 1 && (
                          <span className="text-[10px] text-[var(--np-text-muted)]">
                            ×{p.mentionCount}
                          </span>
                        )}
                        {p.link && (
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
                          >
                            source →
                          </a>
                        )}
                      </div>
                      {/* Verbatim — the party's own phrasing, never fused. */}
                      <p className="text-[12px] text-[var(--np-text-muted)] leading-snug">
                        {p.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {dl.conditional && (
                <p className="text-[11px] text-[var(--np-text-muted)] mt-0.5 leading-snug">
                  ↳ {dl.conditional}
                </p>
              )}
              {dl.actor && (
                <p className="text-[11px] text-[var(--np-text-muted)] mt-0.5">
                  {dl.actor}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: date + source link + report */}
      <div className="flex-shrink-0 text-right">
        <div className="text-[12px] font-medium text-[var(--np-text-strong)]">
          {formatDate(dl.date)}
        </div>
        {/* Contested rows carry per-position source links; single link only for normal rows. */}
        {!dl.contested && dl.link && (
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
          <ReportFlagButton
            itemType="deadline"
            itemRef={feedbackRef}
            docketRef={docketNumber}
            initiallyReported={reportedSet.has(feedbackRef)}
          />
        </div>
      </div>
    </div>
  )
}

export function RecordDeadlines({ docketNumber, deadlines, reportedRefs }: Props) {
  const [expanded, setExpanded] = useState(false)
  const reportedSet = new Set(reportedRefs)

  if (deadlines.length === 0) return null

  const visible = expanded ? deadlines : deadlines.slice(0, INITIAL)
  const hidden  = deadlines.length - INITIAL

  return (
    <div className="flex flex-col gap-2">
      {visible.map((dl, i) => (
        <DeadlineRow
          key={`${dl.date}:${dl.type}:${i}`}
          dl={dl}
          docketNumber={docketNumber}
          reportedSet={reportedSet}
        />
      ))}

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
