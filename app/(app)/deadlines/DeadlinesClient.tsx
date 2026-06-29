"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarPlus, Eye, EyeOff } from "lucide-react"
import type { DashboardDeadline } from "@/app/(app)/dashboard/queries"
import { DeadlineList } from "./DeadlineList"
import { DeadlineCalendar } from "./DeadlineCalendar"
import { downloadIcs } from "./ics"
import {
  TYPE_CHIPS,
  matchesMarket,
  matchesType,
  type TypeFilter,
  type MarketChip,
} from "./filters"

interface Props {
  deadlines:    DashboardDeadline[]
  marketChips:  MarketChip[]
  today:        string
  reportedRefs: string[]
}

function Chip({
  active,
  onClick,
  children,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${
        active
          ? "bg-[var(--np-accent)] text-white border-[var(--np-accent)]"
          : "bg-[var(--np-surface-elevated)] text-[var(--np-text-muted)] border-[var(--np-border)] hover:text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
      }`}
    >
      {children}
    </button>
  )
}

export function DeadlinesClient({ deadlines, marketChips, today, reportedRefs }: Props) {
  const [market, setMarket]               = useState<string>("all")
  const [type, setType]                   = useState<TypeFilter>("all")
  const [showEstimated, setShowEstimated] = useState(true)
  const [selectedDay, setSelectedDay]     = useState<string | null>(null)

  const reportedSet = useMemo(() => new Set(reportedRefs), [reportedRefs])

  // Market + type + estimated filters. Drives the calendar dots AND the ICS
  // export (spec: export respects these three, NOT the day drill-down).
  const baseFiltered = useMemo(
    () =>
      deadlines.filter(
        dl =>
          matchesMarket(dl.jurisdiction, market) &&
          matchesType(dl.type, type) &&
          (showEstimated || !dl.estimated),
      ),
    [deadlines, market, type, showEstimated],
  )

  // The list additionally narrows to a clicked calendar day.
  const listItems = useMemo(
    () => (selectedDay ? baseFiltered.filter(dl => dl.date === selectedDay) : baseFiltered),
    [baseFiltered, selectedDay],
  )

  const showMarketChips = marketChips.length > 1
  const canExport = baseFiltered.length > 0

  // Empty: has tracked dockets but no upcoming deadlines at all.
  if (deadlines.length === 0) {
    return (
      <div className="px-6 py-8 max-w-[1080px] mx-auto">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight mb-6">
          Deadlines
        </h1>
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-6 py-10 text-center">
          <p className="text-[var(--np-text-muted)] text-[14px] mb-3">
            No upcoming deadlines for your tracked matters yet.
          </p>
          <Link
            href="/dockets"
            className="text-[13px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Browse dockets to track more →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-[1080px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
            Deadlines
          </h1>
          <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
            {baseFiltered.length} upcoming · ordered by days remaining
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadIcs(baseFiltered)}
          disabled={!canExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--np-radius-md)] border border-[var(--np-border)] text-[13px] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CalendarPlus size={14} />
          Export .ics
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 mb-8">
        {showMarketChips && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={market === "all"} onClick={() => setMarket("all")}>
              All markets
            </Chip>
            {marketChips.map(chip => (
              <Chip key={chip.key} active={market === chip.key} onClick={() => setMarket(chip.key)}>
                {chip.label}
              </Chip>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[var(--np-text-muted)] mr-0.5">Type</span>
            {TYPE_CHIPS.map(chip => (
              <Chip key={chip.key} active={type === chip.key} onClick={() => setType(chip.key)}>
                {chip.label}
              </Chip>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowEstimated(v => !v)}
            title={showEstimated ? "Hide estimated deadlines" : "Show estimated deadlines"}
            className={`inline-flex items-center gap-1.5 text-[12px] transition-colors cursor-pointer ${
              showEstimated
                ? "text-[var(--np-text-body)] hover:text-[var(--np-text-strong)]"
                : "text-[var(--np-text-muted)] hover:text-[var(--np-text-body)]"
            }`}
          >
            {showEstimated ? <Eye size={14} /> : <EyeOff size={14} />}
            Show estimated
          </button>
        </div>
      </div>

      {/* ── List (grouped by urgency) ── */}
      <DeadlineList deadlines={listItems} today={today} reportedRefs={reportedSet} />

      {/* ── Calendar ── */}
      <section className="mt-12 pt-8 border-t border-[var(--np-border)]">
        <DeadlineCalendar
          deadlines={baseFiltered}
          today={today}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      </section>
    </div>
  )
}
