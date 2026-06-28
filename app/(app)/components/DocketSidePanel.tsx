"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

// ── shared constants (mirrors docket detail page) ─────────────────────────────

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

const DOC_TYPE_LABELS: Record<string, string> = {
  "puct-application":      "Application",
  "puct-order":            "Order",
  "puct-pfd":              "Proposal for Decision",
  "puct-response":         "Response",
  "puct-compliance":       "Compliance Filing",
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

function docTypeLabel(t: string) { return DOC_TYPE_LABELS[t] ?? t }

function docTypeBadgeClass(t: string): string {
  if (["puct-order", "ferc-order"].includes(t))
    return "bg-[rgba(99,102,241,0.12)] text-[var(--np-indigo-300)] border-[rgba(99,102,241,0.25)]"
  if (["puct-pfd", "puct-open-meeting"].includes(t))
    return "bg-[rgba(99,102,241,0.08)] text-[var(--np-indigo-300)] border-[rgba(99,102,241,0.2)]"
  if (["puct-compliance"].includes(t))
    return "bg-[rgba(34,197,94,0.08)] text-[var(--np-success)] border-[rgba(34,197,94,0.2)]"
  if (["puct-rulemaking", "ferc-tariff-amendment"].includes(t))
    return "bg-[rgba(251,191,36,0.1)] text-[#FCD34D] border-[rgba(251,191,36,0.3)]"
  return "bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border-[var(--np-border)]"
}

function formatDate(d: string): string {
  return new Date(d + (d.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  })
}

// ── types ─────────────────────────────────────────────────────────────────────

interface DocketData {
  docket: {
    externalId:   string
    jurisdiction: string | null
    title:        string | null
    isTracked:    boolean
  }
  filings: Array<{
    id:        string
    title:     string
    docType:   string
    filedAt:   string
    sourceUrl: string | null
    filer:     string | null
    summary:   string | null
  }>
  parties:  string[]
  timeline: Array<{ date: string; description: string; type: string }>
}

// ── FilingSummary (collapsed by default) ─────────────────────────────────────

function FilingSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mt-1">
      <p
        className={`text-[12px] text-[var(--np-text-muted)] leading-relaxed ${expanded ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {text.length > 120 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-[11px] text-[var(--np-accent-text)] hover:underline mt-0.5 cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function DocketSidePanel() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const docketParam  = searchParams.get("docket")

  const [data,    setData]    = useState<DocketData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errored, setErrored] = useState(false)
  const [showAllParties, setShowAllParties] = useState(false)

  // Track the last fetched param to avoid duplicate fetches
  const lastFetched = useRef<string | null>(null)

  function closePanel() {
    const u = new URL(window.location.href)
    u.searchParams.delete("docket")
    const qs = u.searchParams.toString()
    router.push(u.pathname + (qs ? "?" + qs : ""), { scroll: false })
  }

  // Fetch when param changes
  useEffect(() => {
    if (!docketParam) {
      // Intentional reset when the panel closes (no docket selected). The sync
      // setState here runs only on the clear path, not in a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
      lastFetched.current = null
      return
    }
    if (docketParam === lastFetched.current) return
    lastFetched.current = docketParam
    setLoading(true)
    setErrored(false)
    fetch(`/api/docket/${encodeURIComponent(docketParam)}`)
      .then(r => {
        if (!r.ok) throw new Error("not found")
        return r.json() as Promise<DocketData>
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setErrored(true); setLoading(false) })
  }, [docketParam])

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && docketParam) closePanel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docketParam])

  // Group filings by day
  const filingGroups = useMemo(() => {
    if (!data) return []
    const groups: Array<{ date: string; items: DocketData["filings"] }> = []
    for (const f of data.filings) {
      const day = f.filedAt.slice(0, 10)
      const last = groups.at(-1)
      if (last && last.date === day) last.items.push(f)
      else groups.push({ date: day, items: [f] })
    }
    return groups
  }, [data])

  const isOpen = !!docketParam

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closePanel}
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={data ? `Docket ${data.docket.externalId}` : "Docket detail"}
        className={`
          fixed top-0 right-0 h-full w-[720px] max-w-[95vw]
          bg-[var(--np-surface-elevated)] border-l border-[var(--np-border)]
          z-50 shadow-2xl flex flex-col overflow-hidden
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--np-border)] flex-shrink-0">
          {data ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {data.docket.jurisdiction && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)] font-medium flex-shrink-0">
                    {JURISDICTION_BADGE[data.docket.jurisdiction] ?? data.docket.jurisdiction}
                  </span>
                )}
                <span className="font-mono text-[13px] font-medium text-[var(--np-text-primary)]">
                  {data.docket.externalId}
                </span>
              </div>
              {data.docket.title && (
                <p className="text-[12px] text-[var(--np-text-muted)] leading-snug max-w-[520px]">
                  {data.docket.title}
                </p>
              )}
            </div>
          ) : (
            <div className="h-9 w-48 rounded bg-[var(--np-surface-deep)] animate-pulse" />
          )}
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close panel"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-[var(--np-radius-md)] text-[var(--np-text-muted)] hover:text-[var(--np-text-strong)] hover:bg-[var(--np-surface-deep)] transition-colors cursor-pointer text-[16px] leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="space-y-3">
              {[80, 60, 100, 70].map(w => (
                <div key={w} className={`h-3 rounded bg-[var(--np-surface-deep)] animate-pulse`} style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {errored && (
            <p className="text-[13px] text-[var(--np-text-muted)]">
              Could not load docket — try again.
            </p>
          )}

          {data && !loading && (
            <>
              {/* Key dates */}
              {data.timeline.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-wider mb-2">
                    Key dates
                  </h2>
                  <div className="space-y-1.5">
                    {data.timeline.map((e, i) => (
                      <div key={i} className="flex items-start gap-3 text-[12px]">
                        <span className="text-[var(--np-text-muted)] w-24 shrink-0 pt-px font-mono text-[11px]">
                          {formatDate(e.date)}
                        </span>
                        <span className={e.type === "deadline" ? "text-[var(--np-deadline)]" : "text-[var(--np-text-body)]"}>
                          {e.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filings */}
              {filingGroups.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-wider mb-2">
                    Recent filings
                    {data.filings.length === 50 && (
                      <span className="ml-1 normal-case font-normal opacity-60">— latest 50</span>
                    )}
                  </h2>
                  <div className="space-y-4">
                    {filingGroups.map(({ date, items }) => (
                      <div key={date}>
                        <p className="text-[10px] font-medium text-[var(--np-text-muted)] uppercase tracking-wide mb-1.5">
                          {formatDate(date)}
                        </p>
                        <div className="space-y-2">
                          {items.map(f => (
                            <div
                              key={f.id}
                              className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-deep)] px-3 py-2.5"
                            >
                              <div className="flex items-start gap-2">
                                <span className={`flex-shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${docTypeBadgeClass(f.docType)}`}>
                                  {docTypeLabel(f.docType)}
                                </span>
                                <div className="min-w-0">
                                  {f.sourceUrl ? (
                                    <a
                                      href={f.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[12px] font-medium text-[var(--np-text-strong)] hover:text-[var(--np-accent-text)] transition-colors"
                                    >
                                      {f.title}
                                    </a>
                                  ) : (
                                    <span className="text-[12px] font-medium text-[var(--np-text-strong)]">
                                      {f.title}
                                    </span>
                                  )}
                                  {f.summary && <FilingSummary text={f.summary} />}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.filings.length === 0 && (
                <p className="text-[13px] text-[var(--np-text-muted)]">No filings found.</p>
              )}

              {/* Parties — moved below the actionable content and collapsed */}
              {data.parties.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-wider mb-2">
                    Parties{" "}
                    <span className="font-normal normal-case text-[var(--np-text-muted)]">
                      ({data.parties.length})
                    </span>
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {(showAllParties ? data.parties : data.parties.slice(0, 10)).map(p => (
                      <span
                        key={p}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--np-surface-deep)] text-[var(--np-text-body)] border border-[var(--np-border)]"
                      >
                        {p}
                      </span>
                    ))}
                    {!showAllParties && data.parties.length > 10 && (
                      <button
                        onClick={() => setShowAllParties(true)}
                        className="text-[11px] px-2 py-0.5 rounded-full text-[var(--np-accent-text)] border border-[var(--np-border)] hover:bg-[var(--np-surface-deep)] transition-colors cursor-pointer"
                      >
                        Show all ({data.parties.length})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--np-border)] flex items-center justify-between">
            <span className="text-[11px] text-[var(--np-text-muted)]">
              {data.docket.isTracked ? "Tracked ✓" : "Not tracked"}
            </span>
            <Link
              href={`/dockets/${encodeURIComponent(data.docket.externalId)}`}
              className="text-[12px] text-[var(--np-accent-text)] hover:underline"
            >
              View full docket →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
