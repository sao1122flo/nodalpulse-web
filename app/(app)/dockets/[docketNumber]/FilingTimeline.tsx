import Link from "next/link"
import type { RecordFiling } from "./queries"
import { FilingSummary } from "./FilingSummary"

const DOC_TYPE_LABELS: Record<string, string> = {
  "puct-application":      "Application",
  "puct-order":            "Order",
  "puct-pfd":              "Proposal for Decision",
  "puct-response":         "Response",
  "puct-compliance":       "Compliance",
  "puct-rulemaking":       "Rulemaking",
  "puct-open-meeting":     "Open Meeting",
  "puct-filing":           "Filing",
  "ferc-order":            "Order",
  "ferc-tariff-amendment": "Tariff Amendment",
  "pjm-filing":            "Filing",
  "caiso-filing":          "Filing",
  "cpuc-filing":           "Filing",
  "ercot-nprr":            "NPRR",
  "ercot-pgrr":            "PGRR",
  "ercot-mn":              "Market Notice",
}

const docTypeLabel = (t: string): string => DOC_TYPE_LABELS[t] ?? t

// Accent dot for orders/decisions and the most recent filing; muted otherwise.
function dotClass(t: string, isFirst: boolean): string {
  if (isFirst) return "bg-[var(--np-accent)]"
  if (["puct-order", "ferc-order", "puct-pfd", "puct-open-meeting"].includes(t))
    return "bg-[var(--np-indigo-300)]"
  return "bg-[var(--np-border-strong)]"
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

interface Props {
  filings:     RecordFiling[]
  total:       number
  viewAllHref: string | null
}

export function FilingTimeline({ filings, total, viewAllHref }: Props) {
  if (filings.length === 0) {
    return (
      <p className="text-[var(--np-text-muted)] text-[13px] py-3">
        No filings yet — they&rsquo;ll appear here after the next crawl.
      </p>
    )
  }

  const truncated = viewAllHref !== null && total > filings.length

  return (
    <div className="relative pl-6">
      {/* connecting line */}
      <div className="absolute left-[5px] top-1.5 bottom-1 w-px bg-[var(--np-border)]" aria-hidden="true" />

      <div className="flex flex-col gap-5">
        {filings.map((f, i) => (
          <div key={f.id} className="relative">
            <span
              className={`absolute -left-[23px] top-1 w-[11px] h-[11px] rounded-full ring-2 ring-[var(--np-surface)] ${dotClass(f.docType, i === 0)}`}
              aria-hidden="true"
            />
            <div className="text-[11px] text-[var(--np-text-muted)] mb-0.5">
              {formatDate(f.filedAt)}{f.filer ? ` · ${f.filer}` : ""}
            </div>
            {f.sourceUrl ? (
              <a
                href={f.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-[var(--np-text-strong)] font-medium hover:text-[var(--np-accent-text)] transition-colors"
              >
                {f.title}
              </a>
            ) : (
              <span className="text-[13px] text-[var(--np-text-strong)] font-medium">{f.title}</span>
            )}
            {f.summary && <FilingSummary text={f.summary} />}
            <div className="mt-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)]">
                {docTypeLabel(f.docType)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {truncated && viewAllHref && (
        <Link
          href={viewAllHref}
          className="inline-block mt-5 text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
        >
          View all {total} filings ↓
        </Link>
      )}
    </div>
  )
}
