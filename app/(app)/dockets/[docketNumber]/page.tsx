import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets, filings, extractions } from "@/db/schema"
import { and, eq, gte, lt, desc, isNotNull, count } from "drizzle-orm"
import { TrackButton } from "../TrackButton"
import { PartiesPills } from "./PartiesPills"
import { FilingSummary } from "./FilingSummary"

export const metadata: Metadata = { title: "Docket" }

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
  // PUCT
  "puct-application":      "Application",
  "puct-order":            "Order",
  "puct-pfd":              "Proposal for Decision",
  "puct-response":         "Response",
  "puct-compliance":       "Compliance Filing",
  "puct-rulemaking":       "Rulemaking",
  "puct-open-meeting":     "Open Meeting",
  "puct-filing":           "Filing",
  // FERC / PJM-FERC
  "ferc-order":            "Order",
  "ferc-tariff-amendment": "Tariff Amendment",
  "pjm-filing":            "Filing",
  // CAISO / CPUC
  "caiso-filing":          "Filing",
  "cpuc-filing":           "Filing",
  // ERCOT
  "ercot-nprr":            "NPRR",
  "ercot-pgrr":            "PGRR",
  "ercot-mn":              "Market Notice",
}

function docTypeLabel(t: string): string {
  return DOC_TYPE_LABELS[t] ?? t
}

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

function formatDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d + "T12:00:00Z") : d
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export default async function DocketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ docketNumber: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { docketNumber } = await params
  const { date: dateParam } = await searchParams
  const dn = decodeURIComponent(docketNumber)

  // Validate optional ?date=YYYY-MM-DD param; ignore if malformed
  const filterDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : null

  const filterDateStart = filterDate ? new Date(filterDate + "T00:00:00Z") : null
  const filterDateEnd   = filterDate
    ? new Date(new Date(filterDate + "T00:00:00Z").getTime() + 86_400_000)
    : null

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Look up the docket row — any jurisdiction, excluding ghost rows (jurisdiction IS NULL).
  // When multiple rows share the same external_id (cross-source duplicates), pick the one
  // with the most filings for a deterministic, content-rich result.
  const [docketRow] = await db
    .select({ id: dockets.id, jurisdiction: dockets.jurisdiction, title: dockets.title })
    .from(dockets)
    .leftJoin(filings, eq(filings.docketId, dockets.id))
    .where(and(eq(dockets.externalId, dn), isNotNull(dockets.jurisdiction)))
    .groupBy(dockets.id, dockets.jurisdiction)
    .orderBy(desc(count(filings.id)))
    .limit(1)

  if (!docketRow) notFound()

  // All filings for this docket, with extraction payload where available.
  // When ?date=YYYY-MM-DD is present, filter to that day only.
  const filingRows = docketRow
    ? await db
        .select({
          id:        filings.id,
          title:     filings.title,
          docType:   filings.docType,
          filedAt:   filings.filedAt,
          sourceUrl: filings.sourceUrl,
          filer:     filings.filer,
          payload:   extractions.payload,
        })
        .from(filings)
        .leftJoin(extractions, eq(extractions.filingId, filings.id))
        .where(
          filterDate && filterDateStart && filterDateEnd
            ? and(
                eq(filings.docketId, docketRow.id),
                gte(filings.filedAt, filterDateStart),
                lt(filings.filedAt,  filterDateEnd),
              )
            : eq(filings.docketId, docketRow.id)
        )
        .orderBy(desc(filings.filedAt))
        .limit(filterDate ? 200 : 50)
    : []

  // Group filings by calendar day (filedAt is already ordered desc)
  type FilingGroup = { date: string; items: typeof filingRows }
  const filingGroups: FilingGroup[] = []
  for (const f of filingRows) {
    const d = f.filedAt.toISOString().slice(0, 10)
    const last = filingGroups.at(-1)
    if (last && last.date === d) last.items.push(f)
    else filingGroups.push({ date: d, items: [f] })
  }

  // Deduplicated parties across all filings.
  // Strip LLM-appended role annotations like " (Intervenor, pro se)" before dedup —
  // canonical name cleanup is services #116.
  const normalizeParty = (name: string) => name.replace(/\s*\(.*$/, "").trim()
  const allParties = filingRows.flatMap(r => r.payload?.parties ?? [])
  const parties = [...new Set(allParties.map(normalizeParty))].filter(Boolean).sort()

  // Timeline events: deadlines + effective dates, deduped and sorted ascending
  type TimelineEvent = { date: string; description: string; type: "deadline" | "effective" }
  const rawTimeline: TimelineEvent[] = []
  for (const row of filingRows) {
    for (const d of row.payload?.deadlines ?? []) {
      if (d.date) rawTimeline.push({ date: d.date, description: d.description, type: "deadline" })
    }
    if (row.payload?.effective_date) {
      rawTimeline.push({
        date: row.payload.effective_date,
        description: `Effective — ${row.title}`,
        type: "effective",
      })
    }
  }
  const seen = new Set<string>()
  const timeline = rawTimeline
    .filter(e => {
      const k = `${e.date}:${e.description}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  // Tracking state — docketRow already found above, no need to re-join dockets
  const [trackRecord] = docketRow
    ? await db
        .select({ id: userDockets.id })
        .from(userDockets)
        .where(and(
          eq(userDockets.userId, session.user.id),
          eq(userDockets.docketId, docketRow.id),
        ))
        .limit(1)
    : [undefined]

  const isTracked = !!trackRecord

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Back link */}
      <div className="mb-5">
        <Link
          href="/dockets"
          className="text-[var(--np-text-muted)] text-[13px] hover:text-[var(--np-text-body)] transition-colors"
        >
          &larr; Dockets
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
            {JURISDICTION_BADGE[docketRow.jurisdiction ?? ""] ?? docketRow.jurisdiction ?? ""} {dn}
          </h1>
          {docketRow.title && (
            <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5 max-w-lg">
              {docketRow.title}
            </p>
          )}
        </div>
        <TrackButton docketNumber={dn} isTracked={isTracked} />
      </div>

      {filingRows.length === 0 ? (
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-12 text-center">
          <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-2">
            No filings found for docket {dn}
          </h2>
          <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed">
            Filings will appear here after the next crawl.
            You can still track this docket above.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Parties */}
          {parties.length > 0 && (
            <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
              <h2 className="text-[var(--np-text-primary)] font-medium text-[13px] mb-3">
                Parties
              </h2>
              <PartiesPills parties={parties} />
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
              <h2 className="text-[var(--np-text-primary)] font-medium text-[13px] mb-3">
                Key dates
              </h2>
              <div className="space-y-2">
                {timeline.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 text-[13px]">
                    <span className="text-[var(--np-text-muted)] text-[12px] w-24 shrink-0 pt-px">
                      {formatDate(e.date)}
                    </span>
                    <span
                      className={
                        e.type === "deadline"
                          ? "text-[var(--np-deadline)] leading-relaxed"
                          : "text-[var(--np-text-body)] leading-relaxed"
                      }
                    >
                      {e.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filings */}
          <div>
            <h2 className="text-[var(--np-text-primary)] font-medium text-[13px] mb-3">
              {filterDate
                ? `Filings — ${formatDate(filterDate)} (${filingRows.length})`
                : filingRows.length === 50
                  ? "Filings — showing latest 50"
                  : `Filings (${filingRows.length})`}
            </h2>

            {/* Desktop table */}
            <div className="hidden md:block rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--np-border)]">
                    {["Type", "Filing"].map(col => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-[var(--np-text-muted)] text-[11px] font-medium uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                {filingGroups.map(({ date, items }) => (
                  <tbody key={date}>
                    <tr className="border-b border-[var(--np-border)] bg-[var(--np-surface-deep)]">
                      <td colSpan={2} className="px-4 py-1.5 text-[11px] font-medium text-[var(--np-text-muted)] uppercase tracking-wide">
                        {formatDate(date)}
                      </td>
                    </tr>
                    {items.map(f => (
                      <tr key={f.id} className="border-b border-[var(--np-border)] last:border-0">
                        <td className="px-4 py-3 w-36 align-top">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${docTypeBadgeClass(f.docType)}`}>
                            {docTypeLabel(f.docType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {f.sourceUrl ? (
                            <a
                              href={f.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--np-text-strong)] font-medium hover:text-[var(--np-accent-text)] transition-colors"
                            >
                              {f.title}
                            </a>
                          ) : (
                            <span className="text-[var(--np-text-strong)] font-medium">{f.title}</span>
                          )}
                          {f.payload?.summary && (
                            <FilingSummary text={f.payload.summary} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden flex flex-col gap-4">
              {filingGroups.map(({ date, items }) => (
                <div key={date}>
                  <p className="text-[11px] font-medium text-[var(--np-text-muted)] uppercase tracking-wide px-1 mb-2">
                    {formatDate(date)}
                  </p>
                  <div className="flex flex-col gap-2">
                    {items.map(f => (
                      <div
                        key={f.id}
                        className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-3"
                      >
                        <div className="mb-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${docTypeBadgeClass(f.docType)}`}>
                            {docTypeLabel(f.docType)}
                          </span>
                        </div>
                        {f.sourceUrl ? (
                          <a
                            href={f.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--np-text-strong)] font-medium text-[13px] hover:text-[var(--np-accent-text)] transition-colors block"
                          >
                            {f.title}
                          </a>
                        ) : (
                          <p className="text-[var(--np-text-strong)] font-medium text-[13px]">{f.title}</p>
                        )}
                        {f.payload?.summary && (
                          <FilingSummary text={f.payload.summary} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lineage stub — Phase 12b */}
          <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
            <h2 className="text-[var(--np-text-primary)] font-medium text-[13px] mb-1">
              Related proceedings
            </h2>
            <p className="text-[var(--np-text-muted)] text-[12px]">
              Lineage extraction coming in a future update.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
