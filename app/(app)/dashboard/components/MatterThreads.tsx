import Link from "next/link"
import type { MatterThread, DashboardDeadline } from "../queries"

const JURISDICTION_BADGE: Record<string, { label: string; color: string }> = {
  PUCT:         { label: "PUCT",  color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" },
  ERCOT:        { label: "ERCOT", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800" },
  "CAISO-FERC": { label: "CAISO", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800" },
  CAISO:        { label: "CAISO", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800" },
  CPUC:         { label: "CPUC",  color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800" },
  "PJM-FERC":   { label: "PJM",   color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800" },
  PJM:          { label: "PJM",   color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800" },
  FERC:         { label: "FERC",  color: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/30 dark:text-slate-300 dark:border-slate-700" },
}

function JurisdictionBadge({ jurisdiction }: { jurisdiction: string | null }) {
  if (!jurisdiction) return null
  const cfg = JURISDICTION_BADGE[jurisdiction] ?? { label: jurisdiction, color: "bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border-[var(--np-border)]" }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function DeadlinePill({ dl }: { dl: DashboardDeadline }) {
  const isUrgent = dl.daysRemaining <= 7
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border ${
      isUrgent
        ? "bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.3)] text-[#92400E]"
        : "bg-[var(--np-surface-deep)] border-[var(--np-border)] text-[var(--np-text-muted)]"
    }`}>
      <span className="font-medium">{dl.daysRemaining}d</span>
      <span className="truncate max-w-[160px]">{dl.description}</span>
      {dl.estimated && <span className="text-[9px] opacity-70">est.</span>}
      {dl.verifyUrl && (
        <a
          href={dl.verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-60 hover:opacity-100 transition-opacity"
          title="Verify deadline"
        >
          ↗
        </a>
      )}
    </div>
  )
}

interface Props {
  threads: MatterThread[]
}

export function MatterThreads({ threads }: Props) {
  if (threads.length === 0) {
    return (
      <div className="text-[var(--np-text-muted)] text-[13px] py-3">
        No tracked matters. Track a docket to see it here.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {threads.map(thread => {
        const docketHref = `/dockets/${encodeURIComponent(thread.externalId)}`
        const hasLinked = thread.linkedDockets.length > 0

        return (
          <div
            key={thread.docketId}
            className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-4"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <JurisdictionBadge jurisdiction={thread.jurisdiction} />
                <div className="min-w-0">
                  <Link
                    href={docketHref}
                    className="text-[13px] font-medium text-[var(--np-text-primary)] hover:text-[var(--np-accent-text)] transition-colors leading-snug"
                  >
                    {thread.title ?? thread.externalId}
                  </Link>
                  <p className="text-[11px] text-[var(--np-text-muted)] mt-0.5">
                    {thread.externalId}
                    {thread.status === "closed" && (
                      <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-[var(--np-surface-deep)] border border-[var(--np-border)]">
                        Closed
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Next deadline */}
            {thread.nextDeadline && (
              <div className="mb-3">
                <DeadlinePill dl={thread.nextDeadline} />
              </div>
            )}

            {/* Linked dockets (cross-jurisdiction) — cap at 5, show overflow count */}
            {hasLinked && (
              <div className="mb-3">
                <p className="text-[11px] text-[var(--np-text-muted)] mb-1.5">Also filed in:</p>
                <div className="flex flex-wrap gap-1.5">
                  {thread.linkedDockets.slice(0, 5).map(ld => (
                    <Link
                      key={ld.id}
                      href={`/dockets/${encodeURIComponent(ld.externalId)}`}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-[var(--np-border)] bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] hover:text-[var(--np-accent-text)] hover:border-[var(--np-accent)] transition-colors"
                    >
                      <JurisdictionBadge jurisdiction={ld.jurisdiction} />
                      <span className="truncate max-w-[120px]">{ld.externalId}</span>
                    </Link>
                  ))}
                  {thread.linkedDockets.length > 5 && (
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 text-[var(--np-text-muted)]">
                      +{thread.linkedDockets.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Parties */}
            {thread.parties.length > 0 && (
              <div>
                <p className="text-[11px] text-[var(--np-text-muted)] mb-1">Parties:</p>
                <p className="text-[12px] text-[var(--np-text-body)] leading-relaxed">
                  {thread.parties.join(" · ")}
                </p>
              </div>
            )}

          </div>
        )
      })}
    </div>
  )
}
