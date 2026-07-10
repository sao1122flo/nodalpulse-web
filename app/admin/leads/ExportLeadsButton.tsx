"use client"

export type LeadExportRow = {
  email: string
  name: string
  title: string
  market: string
  capturedAt: string // ISO timestamp
}

function toCsv(rows: LeadExportRow[]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`
  const header = ["email", "name", "title", "market", "captured_at"].join(",")
  const body = rows.map(r =>
    [r.email, r.name, r.title, r.market, r.capturedAt].map(escape).join(","),
  )
  return [header, ...body].join("\r\n")
}

export function ExportLeadsButton({ rows }: { rows: LeadExportRow[] }) {
  function handleExport() {
    const csv = toCsv(rows)
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const stamp = new Date().toISOString().slice(0, 10)
    const a = document.createElement("a")
    a.href = url
    a.download = `leads-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="px-2.5 py-1 rounded text-[11px] font-mono border border-[var(--np-border)] text-[var(--np-text-body)] hover:bg-[var(--np-surface-deep)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      Export CSV
    </button>
  )
}
