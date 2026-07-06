import { forbidden } from "next/navigation"
import { desc } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { digestLeads } from "@/db/schema"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"
import { formatCT } from "@/lib/format-ct"
import { ExportLeadsButton, type LeadExportRow } from "./ExportLeadsButton"

export const metadata: Metadata = { title: "Leads — Admin — NodalPulse" }

type LeadRow = {
  email: string
  source: string
  captured: string
}

export default async function AdminLeadsPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_leads" })

  const leads = await db
    .select({
      email: digestLeads.email,
      source: digestLeads.source,
      createdAt: digestLeads.createdAt,
    })
    .from(digestLeads)
    .orderBy(desc(digestLeads.createdAt))

  const rows: LeadRow[] = leads.map(l => ({
    email: l.email,
    source: l.source,
    captured: formatCT(new Date(l.createdAt)),
  }))

  const exportRows: LeadExportRow[] = leads.map(l => ({
    email: l.email,
    source: l.source,
    capturedAt: new Date(l.createdAt).toISOString(),
  }))

  const columns: DenseColumn<LeadRow>[] = [
    { key: "email", header: "Email" },
    { key: "source", header: "Source" },
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
            {rows.length} lead{rows.length !== 1 ? "s" : ""} captured from the public digest
            (lead magnet). Deduplicated by email.
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
