import Link from "next/link"
import type { FeedGroup } from "../queries"

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

const JURISDICTION_BADGE: Record<string, string> = {
  PUCT:         "PUCT",
  ERCOT:        "ERCOT",
  "CAISO-FERC": "CAISO",
  CAISO:        "CAISO",
  CPUC:         "CPUC",
  "PJM-FERC":   "PJM",
  PJM:          "PJM",
  FERC:         "FERC",
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return "< 1h ago"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface Props {
  groups: FeedGroup[]
}

export function WhatChangedFeed({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="text-[var(--np-text-muted)] text-[13px] py-3">
        No new filings in the last 7 days for tracked matters.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(group => {
        const jurisdictionLabel = group.jurisdiction
          ? (JURISDICTION_BADGE[group.jurisdiction] ?? group.jurisdiction)
          : null
        const docketHref = `/dockets/${encodeURIComponent(group.docketExternalId)}`

        return (
          <div
            key={group.docketId}
            className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden"
          >
            {/* Matter header */}
            <div className="px-4 py-3 border-b border-[var(--np-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {jurisdictionLabel && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)] font-medium">
                    {jurisdictionLabel}
                  </span>
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
                          <span className="text-[11px] text-[var(--np-text-muted)]">
                            {formatRelative(item.filedAt)}
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
