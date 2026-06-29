import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getEntitlements } from "@/lib/entitlements"
import { getQnaUsage } from "@/lib/services-client"
import { getReportedRefs } from "@/lib/feedback/queries"
import { JURISDICTION_TO_MARKET } from "@/app/(app)/dashboard/queries"
import {
  JurisdictionBadge,
  jurisdictionLabel,
  jurisdictionStyle,
} from "@/app/(app)/dashboard/components/JurisdictionBadge"
import { AskTheRecord } from "@/app/(app)/dashboard/components/AskTheRecord"
import { TrackButton } from "../TrackButton"
import { FilingTimeline } from "./FilingTimeline"
import { RecordDeadlines } from "./RecordDeadlines"
import { KeyParties } from "./KeyParties"
import {
  resolveDocket,
  getDocketMeta,
  getDocketFilingsPage,
  getDocketParties,
  getDocketDeadlines,
  getLinkedDockets,
  getDocketSalience,
  isDocketTracked,
} from "./queries"
import type { DocketSalience } from "./queries"

export const metadata: Metadata = { title: "Docket" }

const FILINGS_DEFAULT = 40
const FILINGS_ALL     = 300

// Market code → region label, so a PUCT docket reads "Texas · PUCT".
const MARKET_REGION: Record<string, string> = {
  PUCT: "Texas", ERCOT: "Texas", CAISO: "California", PJM: "PJM", FERC: "FERC",
}

function marketPillLabel(jurisdiction: string | null): string | null {
  if (!jurisdiction) return null
  const mkt = JURISDICTION_TO_MARKET[jurisdiction] ?? null
  if (!mkt) return jurisdictionLabel(jurisdiction)
  const region = MARKET_REGION[mkt] ?? mkt
  const label = jurisdictionLabel(jurisdiction)
  return region === label ? label : `${region} · ${label}`
}

function formatDate(d: Date | string | null): string {
  if (!d) return "—"
  const dt = typeof d === "string" ? new Date(d + "T12:00:00Z") : d
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function timeAgo(d: Date | null): string {
  if (!d) return "—"
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years > 1 ? "s" : ""} ago`
}

function StatusPill({ status }: { status: string }) {
  const isClosed = status === "closed"
  const label = isClosed ? "Closed" : status === "open" ? "Active" : status
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
        isClosed
          ? "bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border-[var(--np-border)]"
          : "bg-[var(--np-accent-fill)] text-[var(--np-accent-text)] border-[rgba(99,102,241,0.25)]"
      }`}
    >
      {label}
    </span>
  )
}

function SalienceTrendBadge({ salience }: { salience: DocketSalience }) {
  const base = "text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0"
  if (salience.trend === "accelerating") {
    return <span className={`${base} bg-[rgba(34,197,94,0.10)] text-[var(--np-success)] border-[rgba(34,197,94,0.30)]`}>Accelerating ↗</span>
  }
  if (salience.trend === "cooling") {
    return <span className={`${base} bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border-[var(--np-border)]`}>Cooling ↓</span>
  }
  if (salience.trend === "steady") {
    return <span className={`${base} bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border-[var(--np-border)]`}>Steady</span>
  }
  return <span className={`${base} bg-[rgba(34,197,94,0.10)] text-[var(--np-success)] border-[rgba(34,197,94,0.30)]`}>Salience {Math.round(salience.score)}</span>
}

function RecordHeader({
  externalId, jurisdiction, status, title, meta, track,
}: {
  externalId: string
  jurisdiction: string | null
  status: string
  title: string | null
  meta: string
  track: React.ReactNode
}) {
  const pill = marketPillLabel(jurisdiction)
  const dot = jurisdiction ? jurisdictionStyle(jurisdiction).color as string : undefined
  return (
    <>
      {/* Breadcrumb */}
      <nav className="mb-4 text-[13px] text-[var(--np-text-muted)]">
        <Link href="/dockets" className="hover:text-[var(--np-text-body)] transition-colors">Dockets</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span className="text-[var(--np-text-body)]">
          {jurisdiction ? `${jurisdictionLabel(jurisdiction)} ` : ""}{externalId}
        </span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-[var(--np-text-primary)] text-2xl font-semibold tracking-tight">
              {jurisdiction ? `${jurisdictionLabel(jurisdiction)} ` : ""}{externalId}
            </h1>
            {pill && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium border"
                style={jurisdiction ? jurisdictionStyle(jurisdiction) : undefined}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} aria-hidden="true" />
                {pill}
              </span>
            )}
            <StatusPill status={status} />
          </div>
          {title && (
            <p className="text-[var(--np-text-body)] text-[14px] mt-0.5 max-w-2xl leading-snug">{title}</p>
          )}
          <p className="text-[var(--np-text-muted)] text-[12px] mt-2">{meta}</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 flex-shrink-0">
          {track}
          {/* Export — stub, wired in a follow-up */}
          <button
            type="button"
            disabled
            title="Export coming soon"
            className="px-3 py-1.5 rounded-[var(--np-radius-md)] border border-[var(--np-border)] text-[12px] text-[var(--np-text-muted)] opacity-50 cursor-not-allowed text-center"
          >
            Export brief
          </button>
        </div>
      </div>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-[0.06em] mb-3">
      {children}
    </h2>
  )
}

export default async function DocketRecordPage({
  params,
  searchParams,
}: {
  params:       Promise<{ docketNumber: string }>
  searchParams: Promise<{ filings?: string }>
}) {
  const { docketNumber } = await params
  const { filings: filingsParam } = await searchParams
  const dn = decodeURIComponent(docketNumber)
  const showAllFilings = filingsParam === "all"

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const docket = await resolveDocket(dn)
  if (!docket) notFound()

  const [ents, meta] = await Promise.all([
    getEntitlements(session.user.id),
    getDocketMeta(docket.id),
  ])

  const market = JURISDICTION_TO_MARKET[docket.jurisdiction ?? ""] ?? null
  const hasMarketAccess = !!market && ents.marketAccess.includes(market)

  const gateMeta = [
    `${meta.filingCount} filing${meta.filingCount === 1 ? "" : "s"}`,
    meta.lastFiledAt ? `last activity ${timeAgo(meta.lastFiledAt)}` : null,
  ].filter(Boolean).join(" · ")

  // ── Gate 1: market not in plan ────────────────────────────────────────────
  if (!hasMarketAccess) {
    return (
      <div className="px-6 md:px-8 py-8 max-w-3xl">
        <RecordHeader externalId={dn} jurisdiction={docket.jurisdiction} status={docket.status} title={docket.title} meta={gateMeta} track={null} />
        <GateCard
          heading="This market isn't in your plan"
          body={`${market ? `${market} ` : ""}coverage is available on a higher tier. Upgrade to track this proceeding and open its full record.`}
          ctaHref="/pricing"
          ctaLabel="See plans →"
        />
      </div>
    )
  }

  const tracked = await isDocketTracked(session.user.id, docket.id)

  // ── Gate 2: not tracked ───────────────────────────────────────────────────
  if (!tracked) {
    return (
      <div className="px-6 md:px-8 py-8 max-w-3xl">
        <RecordHeader externalId={dn} jurisdiction={docket.jurisdiction} status={docket.status} title={docket.title} meta={gateMeta} track={<TrackButton docketNumber={dn} isTracked={false} />} />
        <GateCard
          heading="Track to see the full record"
          body="Tracking assembles deadlines, the filing timeline, cross-jurisdiction links and scoped Q&A for this proceeding — and folds it into your daily brief."
        />
      </div>
    )
  }

  // ── Full record ───────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const filingLimit = showAllFilings ? FILINGS_ALL : FILINGS_DEFAULT

  const [filings, parties, deadlines, linkedDockets, salience, qnaUsage, reportedDeadlineRefs] =
    await Promise.all([
      getDocketFilingsPage(docket.id, filingLimit),
      getDocketParties(docket.id),
      getDocketDeadlines(docket.id, today),
      getLinkedDockets(docket.id),
      getDocketSalience(docket.externalId),
      getQnaUsage(session.user.id),
      getReportedRefs(session.user.id, "deadline"),
    ])

  const qnaLimitPerDay = ents.qa.limitPerDay ?? 0
  const qnaUsedToday   = qnaUsage.ok ? qnaUsage.value.used_today : 0

  const metaLine = [
    `${parties.length} part${parties.length === 1 ? "y" : "ies"}`,
    `${meta.filingCount} filing${meta.filingCount === 1 ? "" : "s"}`,
    meta.lastFiledAt ? `last activity ${timeAgo(meta.lastFiledAt)}` : null,
  ].filter(Boolean).join(" · ")

  const suggestedQuestions = [
    `What's the latest in ${dn}?`,
    `What are the upcoming deadlines in ${dn}?`,
    `Who are the main parties in ${dn}?`,
  ]

  return (
    <div className="px-6 md:px-8 py-8 max-w-[1120px]">
      <RecordHeader
        externalId={dn}
        jurisdiction={docket.jurisdiction}
        status={docket.status}
        title={docket.title}
        meta={metaLine}
        track={<TrackButton docketNumber={dn} isTracked={true} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
        {/* ── Main column ── */}
        <div className="flex flex-col gap-8 min-w-0">
          {/* What's driving this docket (salience #128) — hero, hidden when no signal */}
          {salience && (
            <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] border-l-2 border-l-[var(--np-success)] bg-[var(--np-surface-elevated)] px-5 py-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--np-text-primary)]">
                  <span className="text-[var(--np-success)]" aria-hidden="true">↗</span>
                  What&rsquo;s driving this docket
                </h2>
                <SalienceTrendBadge salience={salience} />
              </div>
              <p className="text-[13px] text-[var(--np-text-body)] leading-relaxed">
                {salience.headline ?? `Active this week in ${jurisdictionLabel(docket.jurisdiction ?? salience.market)}.`}
              </p>
              {salience.filingsMultiple && salience.filingsMultiple > 1 && (
                <p className="text-[12px] text-[var(--np-text-muted)] mt-1.5">
                  Filing volume up {salience.filingsMultiple}× week-over-week.
                </p>
              )}
            </div>
          )}

          {/* Upcoming deadlines (P0) — hidden when none */}
          {deadlines.length > 0 && (
            <section>
              <SectionLabel>Upcoming deadlines</SectionLabel>
              <RecordDeadlines docketNumber={dn} deadlines={deadlines} reportedRefs={reportedDeadlineRefs} />
            </section>
          )}

          {/* Filing timeline */}
          <section>
            <SectionLabel>Filing timeline</SectionLabel>
            <FilingTimeline
              filings={filings}
              total={meta.filingCount}
              viewAllHref={showAllFilings ? null : `/dockets/${encodeURIComponent(dn)}?filings=all`}
            />
          </section>
        </div>

        {/* ── Right rail (stacks below main on mobile) ── */}
        <aside className="flex flex-col gap-6 min-w-0">
          {/* Linked across jurisdictions — hidden when none */}
          {linkedDockets.length > 0 && (
            <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-accent)] bg-[var(--np-surface-elevated)] px-5 py-4">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--np-text-primary)] mb-3">
                <span className="text-[var(--np-accent-text)]" aria-hidden="true">⇄</span>
                Linked across jurisdictions
              </h2>
              <div className="flex flex-col gap-3">
                {linkedDockets.map(ld => (
                  <Link key={ld.id} href={`/dockets/${encodeURIComponent(ld.externalId)}`} className="flex items-start gap-2 group">
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: ld.jurisdiction ? (jurisdictionStyle(ld.jurisdiction).color as string) : "var(--np-text-muted)" }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-[var(--np-text-strong)] group-hover:text-[var(--np-accent-text)] transition-colors">
                        {ld.jurisdiction ? `${jurisdictionLabel(ld.jurisdiction)} ` : ""}{ld.externalId}
                      </span>
                      {(ld.reason ?? ld.title) && (
                        <span className="block text-[12px] text-[var(--np-text-muted)] leading-snug">
                          {ld.reason ?? ld.title}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Key parties */}
          {parties.length > 0 && (
            <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
              <SectionLabel>Key parties</SectionLabel>
              <KeyParties parties={parties} />
            </div>
          )}

          {/* Ask the record */}
          <div>
            <SectionLabel>Ask the record</SectionLabel>
            <AskTheRecord limitPerDay={qnaLimitPerDay} usedToday={qnaUsedToday} suggestedQuestions={suggestedQuestions} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function GateCard({
  heading, body, ctaHref, ctaLabel,
}: {
  heading: string
  body: string
  ctaHref?: string
  ctaLabel?: string
}) {
  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-12 text-center">
      <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-2">{heading}</h2>
      <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed">{body}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="inline-block mt-4 text-[13px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors">
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
