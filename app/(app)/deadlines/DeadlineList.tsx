"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import type { DashboardDeadline } from "@/app/(app)/dashboard/queries"
import { JurisdictionBadge } from "@/app/(app)/dashboard/components/JurisdictionBadge"
import { ConfidenceBadge } from "@/app/(app)/components/ConfidenceBadge"
import { ReportFlagButton } from "@/app/(app)/components/ReportFlagButton"
import { deadlineFeedbackRef } from "@/lib/feedback/ref"
import {
  BUCKET_ORDER,
  BUCKET_LABEL,
  urgencyBucket,
  urgencyText,
  urgencyBg,
  type UrgencyBucket,
} from "./filters"

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

const LATER_INITIAL = 12

function formatDate(iso: string, currentYear: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" }
  if (iso.slice(0, 4) !== currentYear) opts.year = "numeric"
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", opts)
}

function DeadlineRow({
  dl,
  currentYear,
  reportedRefs,
}: {
  dl: DashboardDeadline
  currentYear: string
  reportedRefs: Set<string>
}) {
  const typeLabel = DEADLINE_TYPE_LABELS[dl.type] ?? "Deadline"
  const isMarketEvent = dl.kind === "market_event"
  const docketHref =
    !isMarketEvent && dl.docketExternalId
      ? `/dockets/${encodeURIComponent(dl.docketExternalId)}`
      : null
  // Filing deadlines (extractions) get a report affordance; market_events are
  // authoritative calendar dates, not extractions — nothing to report.
  const feedbackRef = isMarketEvent
    ? null
    : deadlineFeedbackRef({
        docketExternalId: dl.docketExternalId,
        date:             dl.date,
        type:             dl.type,
        description:      dl.description,
      })

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-[var(--np-radius-md)] border px-4 py-3 ${urgencyBg(dl.daysRemaining)}`}
    >
      {/* Left: countdown + content */}
      <div className="flex items-start gap-3 min-w-0">
        <div className={`flex-shrink-0 text-center w-10 ${urgencyText(dl.daysRemaining)}`}>
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
            <ConfidenceBadge estimated={dl.estimated} />
            {!isMarketEvent && dl.mentionCount > 1 && (
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

          {/* B4: conditional with/without-hearing note (collapsed variants) */}
          {dl.conditional && (
            <p className="text-[11px] text-[var(--np-text-muted)] mt-0.5 leading-snug">
              ↳ {dl.conditional}
            </p>
          )}

          {/* Subtitle: docket chip (→ Record page) or market-event chip · date */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] min-w-0">
            {isMarketEvent ? (
              <span className="inline-flex items-center gap-1 text-[var(--np-text-muted)]">
                <JurisdictionBadge jurisdiction={dl.jurisdiction} />
                Market event
              </span>
            ) : docketHref ? (
              <Link
                href={docketHref}
                className="inline-flex items-center gap-1 text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors min-w-0 max-w-full"
              >
                <JurisdictionBadge jurisdiction={dl.jurisdiction} />
                <span className="truncate">
                  {dl.docketExternalId}
                  {dl.docketTitle ? ` · ${dl.docketTitle}` : ""}
                </span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 text-[var(--np-text-muted)]">
                <JurisdictionBadge jurisdiction={dl.jurisdiction} />
                {dl.docketExternalId}
              </span>
            )}
            <span className="text-[var(--np-text-muted)] whitespace-nowrap">
              · {formatDate(dl.date, currentYear)}
            </span>
          </div>
        </div>
      </div>

      {/* Right: source link (P0 — guaranteed present for filing rows) + report */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        {dl.verifyUrl && (
          <a
            href={dl.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={dl.estimated ? "View source" : "Verify at source"}
            className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--np-radius-md)] border border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-accent-text)] hover:border-[var(--np-border-strong)] transition-colors"
          >
            <ExternalLink size={14} />
          </a>
        )}
        {feedbackRef && (
          <ReportFlagButton
            itemType="deadline"
            itemRef={feedbackRef}
            docketRef={dl.docketExternalId}
            initiallyReported={reportedRefs.has(feedbackRef)}
          />
        )}
      </div>
    </div>
  )
}

interface Props {
  deadlines:    DashboardDeadline[]
  today:        string
  reportedRefs: Set<string>
}

export function DeadlineList({ deadlines, today, reportedRefs }: Props) {
  const [showAllLater, setShowAllLater] = useState(false)
  const currentYear = today.slice(0, 4)

  if (deadlines.length === 0) {
    return (
      <p className="text-[var(--np-text-muted)] text-[13px] py-6">
        No deadlines match these filters.
      </p>
    )
  }

  const buckets: Record<UrgencyBucket, DashboardDeadline[]> = {
    thisWeek: [],
    next30:   [],
    later:    [],
  }
  for (const dl of deadlines) buckets[urgencyBucket(dl.daysRemaining)].push(dl)

  return (
    <div className="flex flex-col gap-8">
      {BUCKET_ORDER.map(bucket => {
        const items = buckets[bucket]
        if (items.length === 0) return null
        const isLater = bucket === "later"
        const visible = isLater && !showAllLater ? items.slice(0, LATER_INITIAL) : items
        const hidden = items.length - visible.length

        return (
          <section key={bucket}>
            <h3 className="text-[12px] font-semibold text-[var(--np-text-muted)] mb-3">
              {BUCKET_LABEL[bucket]}
              <span className="ml-2 tabular-nums font-normal">{items.length}</span>
            </h3>
            <div className="flex flex-col gap-2">
              {visible.map((dl, i) => (
                <DeadlineRow
                  key={`${dl.docketId}:${dl.date}:${dl.type}:${i}`}
                  dl={dl}
                  currentYear={currentYear}
                  reportedRefs={reportedRefs}
                />
              ))}
            </div>
            {isLater && hidden > 0 && (
              <button
                onClick={() => setShowAllLater(true)}
                className="text-left text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors pl-1 py-1 mt-1 cursor-pointer"
              >
                + {hidden} more deadline{hidden !== 1 ? "s" : ""} ↓
              </button>
            )}
            {isLater && showAllLater && items.length > LATER_INITIAL && (
              <button
                onClick={() => setShowAllLater(false)}
                className="text-left text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors pl-1 py-1 mt-1 cursor-pointer"
              >
                View less ↑
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
