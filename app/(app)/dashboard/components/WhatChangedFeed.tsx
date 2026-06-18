import Link from "next/link"
import type { FeedGroup } from "../queries"
import { JurisdictionBadge } from "./JurisdictionBadge"

const DOC_TYPE_LABELS: Record<string, string> = {
  "puct-application":  "Application",
  "puct-order":        "Order",
  "puct-pfd":          "PFD",
  "puct-response":     "Response",
  "puct-compliance":   "Compliance",
  "puct-rulemaking":   "Rulemaking",
  "puct-open-meeting": "Open Meeting",
  "puct-filing":       "Filing",
  "ferc-order":        "FERC Order",
  "ferc-tariff-amendment": "Tariff Amendment",
  "caiso-filing":      "CAISO Filing",
  "ercot-nprr":        "NPRR",
  "ercot-pgrr":        "PGRR",
  "ercot-mn":          "Market Notice",
  "pjm-filing":        "PJM Filing",
}

// Shows absolute timestamp: date + time (CT) when filing has a real time,
// date only when filed_at is midnight UTC (date-only stored value).
function formatTimestamp(d: Date): string {
  const isDateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
  const yr  = d.getUTCFullYear()
  const mo  = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const datePart = `${yr}-${mo}-${day}`
  if (isDateOnly) return datePart
  const ct = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d)
  return `${datePart} ${ct} CT`
}

interface Props {
  groups: FeedGroup[]
}

export function WhatChangedFeed({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="text-[var(--np-text-muted)] text-[13px] py-3">
        No recent changes.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(group => {
          const docketHref = `/dockets/${encodeURIComponent(group.docketExternalId)}`

        return (
          <div
            key={group.docketId}
            className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden"
          >
            {/* Matter header */}
            <div className="px-4 py-3 border-b border-[var(--np-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {group.jurisdiction && (
                  <JurisdictionBadge jurisdiction={group.jurisdiction} />
                )}
                <Link
                  href={docketHref}
                  className="text-[13px] font-medium text-[var(--np-text-primary)] hover:text-[var(--np-accent-text)] transition-colors truncate"
                >
                  {group.docketTitle ?? group.docketExternalId}
                </Link>
              </div>
              <span className="flex-shrink-0 text-[11px] text-[var(--np-text-muted)]">
                {group.items.length} new
              </span>
            </div>

            {/* Filing items */}
            <div className="divide-y divide-[var(--np-border)]">
              {group.items.slice(0, 4).map(item => {
                const typeLabel = DOC_TYPE_LABELS[item.docType] ?? item.docType
                return (
                  <div key={item.filingId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] text-[var(--np-text-muted)] font-medium">
                            {typeLabel}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--np-text-muted)]">
                            {formatTimestamp(item.filedAt)}
                          </span>
                        </div>
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-[var(--np-text-body)] hover:text-[var(--np-accent-text)] transition-colors leading-snug line-clamp-1"
                          >
                            {item.filingTitle}
                          </a>
                        ) : (
                          <p className="text-[13px] text-[var(--np-text-body)] leading-snug line-clamp-1">
                            {item.filingTitle}
                          </p>
                        )}
                        {item.summary && (
                          <p className="text-[12px] text-[var(--np-text-muted)] mt-1 leading-relaxed line-clamp-2">
                            {item.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {group.items.length > 4 && (
                <div className="px-4 py-2">
                  <Link
                    href={docketHref}
                    className="text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
                  >
                    + {group.items.length - 4} more filing{group.items.length - 4 !== 1 ? "s" : ""} →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
