import { forbidden } from "next/navigation"
import { desc } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { leads as leadsTable } from "@/db/schema"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"
import { formatCT } from "@/lib/format-ct"
import { ExportLeadsButton, type LeadExportRow } from "./ExportLeadsButton"

export const metadata: Metadata = { title: "Leads — Admin — NodalPulse" }

type LeadRow = {
  email: string
  name: string
  title: string
  market: string
  captured: string
}

export default async function AdminLeadsPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_leads" })

  // Reads `leads` — the record-page gate captures (/public/lead). Previously
  // read digest_leads, which is the separate (unused) /digest subscribe channel,
  // so real record-page captures were invisible in this view.
  const rowsRaw = await db
    .select({
      email: leadsTable.email,
      name: leadsTable.name,
      title: leadsTable.title,
      market: leadsTable.market,
      capturedAt: leadsTable.capturedAt,
    })
    .from(leadsTable)
    .orderBy(desc(leadsTable.capturedAt))

  const rows: LeadRow[] = rowsRaw.map(l => ({
    email: l.email,
    name: l.name ?? "—",
    title: l.title ?? "—",
    market: l.market ?? "—",
    captured: formatCT(new Date(l.capturedAt)),
  }))

  const exportRows: LeadExportRow[] = rowsRaw.map(l => ({
    email: l.email,
    name: l.name ?? "",
    title: l.title ?? "",
    market: l.market ?? "",
    capturedAt: new Date(l.capturedAt).toISOString(),
  }))

  const columns: DenseColumn<LeadRow>[] = [
    { key: "email", header: "Email" },
    { key: "name", header: "Name" },
    { key: "title", header: "Title" },
    { key: "market", header: "Market" },
    { key: "captured", header: "Captured" },
  ]

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
            Leads
          </h1>
          <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
            {rows.length} lead{rows.length !== 1 ? "s" : ""} captured from record-page unlocks
            (&ldquo;unlock full record&rdquo;). Deduplicated by email.
          </p>
        </div>
        <ExportLeadsButton rows={exportRows} />
      </div>

      <DenseTable<LeadRow>
        columns={columns}
        rows={rows}
        emptyMessage="No leads captured yet."
      />
    </div>
  )
}
