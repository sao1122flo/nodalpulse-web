"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { DashboardDeadline } from "@/app/(app)/dashboard/queries"

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

interface DayInfo {
  hasConfirmed: boolean
  hasEstimated: boolean
  count:        number
}

interface Props {
  deadlines:    DashboardDeadline[]   // already market/type/estimated-filtered
  today:        string                // YYYY-MM-DD (UTC)
  selectedDay:  string | null
  onSelectDay:  (day: string | null) => void
}

export function DeadlineCalendar({ deadlines, today, selectedDay, onSelectDay }: Props) {
  const todayYear  = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7)) - 1
  const [view, setView] = useState({ year: todayYear, month: todayMonth })

  // Date → aggregate info (confirmed/estimated presence drives dot color).
  const byDay = new Map<string, DayInfo>()
  for (const dl of deadlines) {
    const info = byDay.get(dl.date) ?? { hasConfirmed: false, hasEstimated: false, count: 0 }
    if (dl.estimated) info.hasEstimated = true
    else info.hasConfirmed = true
    info.count++
    byDay.set(dl.date, info)
  }

  const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay()
  const daysInMonth  = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () =>
    setView(v => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))
  const nextMonth = () =>
    setView(v => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))

  return (
    <div>
      {/* Header: month nav + legend */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-semibold text-[var(--np-text-primary)]">
            {MONTH_NAMES[view.month]} {view.year}
          </h2>
          <div className="flex items-center">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--np-radius-md)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] hover:bg-[var(--np-surface-deep)] transition-colors cursor-pointer"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--np-radius-md)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] hover:bg-[var(--np-surface-deep)] transition-colors cursor-pointer"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--np-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--np-danger)]" aria-hidden="true" />
            confirmed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FBBF24]" aria-hidden="true" />
            estimated
          </span>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[11px] text-[var(--np-text-muted)] py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="aspect-square" />
          const dateStr   = `${view.year}-${pad(view.month + 1)}-${pad(d)}`
          const info      = byDay.get(dateStr)
          const isToday   = dateStr === today
          const isSelected = dateStr === selectedDay
          const dotColor  = info
            ? info.hasConfirmed ? "bg-[var(--np-danger)]" : "bg-[#FBBF24]"
            : null

          return (
            <button
              key={i}
              type="button"
              disabled={!info}
              onClick={() => info && onSelectDay(isSelected ? null : dateStr)}
              title={info ? `${info.count} deadline${info.count !== 1 ? "s" : ""}` : undefined}
              className={`aspect-square rounded-[var(--np-radius-md)] border flex flex-col items-center justify-center gap-1 transition-colors ${
                isSelected
                  ? "border-[var(--np-accent)] bg-[var(--np-accent-fill)]"
                  : info
                    ? "border-[var(--np-border)] bg-[var(--np-surface-elevated)] hover:border-[var(--np-border-strong)] cursor-pointer"
                    : "border-transparent"
              }`}
            >
              <span
                className={`text-[12px] tabular-nums ${
                  isToday
                    ? "text-[var(--np-accent-text)] font-semibold"
                    : info
                      ? "text-[var(--np-text-body)]"
                      : "text-[var(--np-text-muted)]"
                }`}
              >
                {d}
              </span>
              {dotColor && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <button
          type="button"
          onClick={() => onSelectDay(null)}
          className="mt-3 text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors cursor-pointer"
        >
          Clear day filter ✕
        </button>
      )}
    </div>
  )
}
