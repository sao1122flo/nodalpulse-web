import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets, filings, extractions } from "@/db/schema"
import { and, eq, desc, sql } from "drizzle-orm"
import { TrackButton } from "../TrackButton"

export const metadata: Metadata = { title: "Docket" }

const PUCT_SOURCE_ID = "0725032a-239f-475d-bdd5-251adad3ae05"

const DOC_TYPE_LABELS: Record<string, string> = {
  "puct-application":  "Application",
  "puct-order":        "Order",
  "puct-pfd":          "Proposal for Decision",
  "puct-response":     "Response",
  "puct-compliance":   "Compliance Filing",
  "puct-rulemaking":   "Rulemaking",
  "puct-open-meeting": "Open Meeting",
  "puct-filing":       "Filing",
}

function docTypeLabel(t: string): string {
  return DOC_TYPE_LABELS[t] ?? t
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
}: {
  params: Promise<{ docketNumber: string }>
}) {
  const { docketNumber } = await params
  const dn = decodeURIComponent(docketNumber)

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Filings for this docket number (via extraction payload — filings.docket_id
  // is not yet populated by the pipeline; that migration happens in Phase 12b)
  const filingRows = await db
    .select({
      id:        filings.id,
      title:     filings.title,
      docType:   filings.docType,
      filedAt:   filings.filedAt,
      sourceUrl: filings.sourceUrl,
      filer:     filings.filer,
      payload:   extractions.payload,
    })
    .from(extractions)
    .innerJoin(filings, eq(extractions.filingId, filings.id))
    .where(sql`${extractions.payload}->>'docket_number' = ${dn}`)
    .orderBy(desc(filings.filedAt))
    .limit(50)

  // Deduplicated parties across all filings
  const allParties = filingRows.flatMap(r => r.payload?.parties ?? [])
  const parties = [...new Set(allParties)].sort()

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

  // Tracking state for the current user
  const [trackRecord] = await db
    .select({ id: userDockets.id })
    .from(userDockets)
    .innerJoin(dockets, eq(userDockets.docketId, dockets.id))
    .where(
      and(
        eq(userDockets.userId, session.user.id),
        eq(dockets.sourceId, PUCT_SOURCE_ID),
        eq(dockets.externalId, dn),
      ),
    )
    .limit(1)

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
            PUCT {dn}
          </h1>
          {filingRows[0]?.title && (
            <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5 max-w-lg">
              {filingRows[0].title}
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
            If this is a valid PUCT docket, filings will appear here after the next crawl.
            You can still track it above.
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
              <div className="flex flex-wrap gap-1.5">
                {parties.map(p => (
                  <span
                    key={p}
                    className="
                      inline-flex items-center px-2 py-0.5
                      rounded-full text-[11px]
                      bg-[var(--np-surface-deep)] text-[var(--np-text-body)]
                      border border-[var(--np-border)]
                    "
                  >
                    {p}
                  </span>
                ))}
              </div>
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
              {filingRows.length === 50
                ? "Filings — showing latest 50"
                : `Filings (${filingRows.length})`}
            </h2>

            {/* Desktop table */}
            <div className="hidden md:block rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--np-border)]">
                    {["Date", "Type", "Title / Summary"].map(col => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-[var(--np-text-muted)] text-[11px] font-medium uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filingRows.map(f => (
                    <tr key={f.id} className="border-b border-[var(--np-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--np-text-muted)] text-[12px] w-24 align-top">
                        {formatDate(f.filedAt)}
                      </td>
                      <td className="px-4 py-3 text-[var(--np-text-muted)] text-[12px] w-28 align-top">
                        {docTypeLabel(f.docType)}
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
                          <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5 leading-relaxed">
                            {f.payload.summary}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden flex flex-col gap-2">
              {filingRows.map(f => (
                <div
                  key={f.id}
                  className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-3"
                >
                  <p className="text-[var(--np-text-muted)] text-[11px] mb-1">
                    {formatDate(f.filedAt)} · {docTypeLabel(f.docType)}
                  </p>
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
                    <p className="text-[var(--np-text-muted)] text-[12px] mt-1 leading-relaxed">
                      {f.payload.summary}
                    </p>
                  )}
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
