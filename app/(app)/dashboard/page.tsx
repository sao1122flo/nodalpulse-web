import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getEntitlements } from "@/lib/entitlements"
import { getQnaUsage } from "@/lib/services-client"
import { TrialBanner } from "@/app/(app)/components/TrialBanner"
import {
  getTrackedDocketIds,
  getDeadlines,
  getRecentFeed,
  getMatterThreads,
  jurisdictionsForMarkets,
  MARKET_TO_JURISDICTIONS,
} from "./queries"
import { DeadlineStrip } from "./components/DeadlineStrip"
import { WhatChangedFeed } from "./components/WhatChangedFeed"
import { MatterThreads } from "./components/MatterThreads"
import { AskTheRecord } from "./components/AskTheRecord"

export const metadata: Metadata = { title: "Dashboard" }

// Market chip labels ordered for display
const MARKET_ORDER = ["PUCT", "ERCOT", "CAISO", "PJM", "FERC"]

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; view?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const { market: marketParam, view: viewParam } = await searchParams
  const isTeamView = viewParam === "team"
  const today = new Date().toISOString().slice(0, 10)

  // --- entitlements + QnA usage in parallel ---
  const [ents, qnaUsageResult] = await Promise.all([
    getEntitlements(session.user.id),
    getQnaUsage(session.user.id),
  ])
  const { marketAccess, teamSeats, qa } = ents
  const hasTeam = teamSeats.limit > 1
  const qnaLimitPerDay = qa.limitPerDay ?? 0
  const qnaUsedToday = qnaUsageResult.ok ? qnaUsageResult.value.used_today : 0

  // Resolve active market filter: validate against entitled markets
  const validMarkets = new Set(marketAccess)
  const activeMarket =
    marketParam && (validMarkets.has(marketParam) || marketParam === "all")
      ? marketParam === "all" ? null : marketParam
      : null

  // Entitled jurisdictions for DB filtering
  const entitledJurisdictions = jurisdictionsForMarkets(marketAccess)
  const filteredJurisdictions = activeMarket
    ? (MARKET_TO_JURISDICTIONS[activeMarket] ?? [])
    : entitledJurisdictions

  // --- tracked dockets (Mine vs Team) ---
  const docketIds = await getTrackedDocketIds(session.user.id, isTeamView)

  // Deadlines first; threads use deadlines for the next-deadline pill.
  // Feed is independent and runs in parallel with deadlines.
  const [deadlines, feedGroups] = await Promise.all([
    getDeadlines(docketIds, filteredJurisdictions, today),
    getRecentFeed(docketIds, filteredJurisdictions, today),
  ])

  const threadsWithDeadlines = await getMatterThreads(docketIds, filteredJurisdictions, deadlines)

  // --- progressive disclosure: show market chips only if >1 market ---
  const showChips = marketAccess.length > 1
  const displayedMarkets = MARKET_ORDER.filter(m => validMarkets.has(m))

  return (
    <div className="px-6 py-8 max-w-[1080px] mx-auto">
      <TrialBanner />

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
            Regulatory matters · {today}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mine / Team toggle — shown only when user has a team */}
          {hasTeam && (
            <div className="flex rounded-[var(--np-radius-md)] border border-[var(--np-border)] overflow-hidden text-[12px]">
              <Link
                href="/dashboard"
                className={`px-3 py-1.5 transition-colors ${
                  !isTeamView
                    ? "bg-[var(--np-accent)] text-white font-medium"
                    : "bg-[var(--np-surface-elevated)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)]"
                }`}
              >
                Mine
              </Link>
              <Link
                href="/dashboard?view=team"
                className={`px-3 py-1.5 transition-colors border-l border-[var(--np-border)] ${
                  isTeamView
                    ? "bg-[var(--np-accent)] text-white font-medium"
                    : "bg-[var(--np-surface-elevated)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)]"
                }`}
              >
                Team
              </Link>
            </div>
          )}

          {/* Brief history link */}
          <Link
            href="/briefs"
            className="text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-accent-text)] transition-colors"
          >
            Brief history →
          </Link>
        </div>
      </div>

      {/* ── Market filter chips (only when >1 market entitled) ── */}
      {showChips && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link
            href={isTeamView ? "/dashboard?view=team" : "/dashboard"}
            className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
              activeMarket === null
                ? "bg-[var(--np-accent)] text-white border-[var(--np-accent)]"
                : "bg-[var(--np-surface-elevated)] text-[var(--np-text-muted)] border-[var(--np-border)] hover:text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
            }`}
          >
            All
          </Link>
          {displayedMarkets.map(m => {
            const href = isTeamView
              ? `/dashboard?view=team&market=${m}`
              : `/dashboard?market=${m}`
            return (
              <Link
                key={m}
                href={href}
                className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                  activeMarket === m
                    ? "bg-[var(--np-accent)] text-white border-[var(--np-accent)]"
                    : "bg-[var(--np-surface-elevated)] text-[var(--np-text-muted)] border-[var(--np-border)] hover:text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
                }`}
              >
                {m}
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Ask the Record bar ── */}
      <div className="mb-8">
        <AskTheRecord limitPerDay={qnaLimitPerDay} usedToday={qnaUsedToday} />
      </div>

      {/* ── Empty state: no tracked dockets ── */}
      {docketIds.length === 0 && (
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-6 py-10 text-center">
          <p className="text-[var(--np-text-muted)] text-[14px] mb-3">
            {isTeamView
              ? "No tracked matters in your team yet."
              : "You're not tracking any matters yet."}
          </p>
          <Link
            href="/dockets"
            className="text-[13px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Browse dockets to start tracking →
          </Link>
        </div>
      )}

      {docketIds.length > 0 && (
        <div className="flex flex-col gap-10">

          {/* ── Zone 1: Deadline strip ── */}
          <section>
            <SectionHeader
              title="Upcoming Deadlines"
              count={deadlines.length}
              subtitle="Ordered by days remaining"
            />
            <DeadlineStrip deadlines={deadlines} />
          </section>

          {/* ── Zone 2: What changed ── */}
          <section>
            <SectionHeader
              title="What Changed"
              count={feedGroups.reduce((n, g) => n + g.items.length, 0)}
              subtitle="Last 7 days · grouped by matter"
            />
            <WhatChangedFeed groups={feedGroups} />
          </section>

          {/* ── Zone 3: Matter threads ── */}
          <section>
            <SectionHeader
              title="Matters"
              count={threadsWithDeadlines.length}
              subtitle={isTeamView ? "Team tracked" : "You're tracking"}
            />
            <MatterThreads threads={threadsWithDeadlines} />
          </section>

        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SectionHeader — consistent zone label
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  count,
  subtitle,
}: {
  title: string
  count: number
  subtitle?: string
}) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <h2 className="text-[var(--np-text-primary)] text-[15px] font-semibold">
        {title}
      </h2>
      {count > 0 && (
        <span className="text-[12px] text-[var(--np-text-muted)] tabular-nums">
          {count}
        </span>
      )}
      {subtitle && (
        <span className="text-[12px] text-[var(--np-text-muted)]">
          · {subtitle}
        </span>
      )}
    </div>
  )
}
