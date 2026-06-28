// Client-side iCalendar (.ics) generation for the Deadlines surface (B2).
// One VEVENT per deadline. UID is a stable hash of identity fields so re-imports
// dedupe. Estimated deadlines are marked [est] + STATUS:TENTATIVE so the user's
// calendar reflects uncertainty (never exported as confirmed — P0). buildIcs()
// is pure (stamp injected) for testability; downloadIcs() wraps it for the browser.

import type { DashboardDeadline } from "@/app/(app)/dashboard/queries"

const TYPE_LABELS: Record<string, string> = {
  hearing:          "Hearing",
  compliance:       "Compliance",
  comment_deadline: "Comment",
  rehearing:        "Rehearing",
  effective_date:   "Effective date",
  order_effective:  "Effective date",
  protest_notice:   "Protest",
  calendar:         "Market event",
  implementation:   "Implementation",
  balloting:        "Balloting",
  other:            "Deadline",
}

// FNV-1a → base36. Deterministic across runs so the same deadline yields the
// same UID on every export (calendars dedupe on UID).
function hashStr(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

// RFC 5545 TEXT escaping: backslash, semicolon, comma, newline.
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

// RFC 5545 line folding at 75 octets; continuation lines start with a space.
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(" " + rest)
  return parts.join("\r\n")
}

function dateBasic(iso: string): string {
  return iso.replace(/-/g, "")
}

// All-day DTEND is exclusive → the day after the deadline.
function nextDayBasic(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10).replace(/-/g, "")
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export function icsUid(dl: DashboardDeadline): string {
  return `np-${hashStr(`${dl.docketExternalId}|${dl.date}|${dl.type}|${dl.description}`)}@nodalpulse.com`
}

export function buildIcs(deadlines: DashboardDeadline[], stamp: Date): string {
  const dtstamp = icsStamp(stamp)
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NodalPulse//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const dl of deadlines) {
    const typeLabel = TYPE_LABELS[dl.type] ?? "Deadline"
    const subject = dl.docketExternalId || "Market event"
    const summaryBase = `${typeLabel} — ${subject}`
    const summary = dl.estimated ? `[est] ${summaryBase}` : summaryBase

    const descParts = [dl.description]
    if (dl.docketTitle) descParts.push(`Docket: ${dl.docketTitle}`)
    if (dl.verifyUrl)   descParts.push(`Source: ${dl.verifyUrl}`)
    if (dl.estimated)   descParts.push("(Estimated date — verify at source.)")

    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${icsUid(dl)}`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART;VALUE=DATE:${dateBasic(dl.date)}`)
    lines.push(`DTEND;VALUE=DATE:${nextDayBasic(dl.date)}`)
    lines.push(fold(`SUMMARY:${esc(summary)}`))
    lines.push(fold(`DESCRIPTION:${esc(descParts.join("\n"))}`))
    if (dl.verifyUrl) lines.push(fold(`URL:${esc(dl.verifyUrl)}`))
    lines.push(`STATUS:${dl.estimated ? "TENTATIVE" : "CONFIRMED"}`)
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n") + "\r\n"
}

export function downloadIcs(
  deadlines: DashboardDeadline[],
  filename = "nodalpulse-deadlines.ics",
): void {
  const ics = buildIcs(deadlines, new Date())
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
