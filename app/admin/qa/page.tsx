import { forbidden } from "next/navigation"
import { sql } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"

export const metadata: Metadata = { title: "QA — Admin — NodalPulse" }

// Internal data-quality snapshot (B4 §5). Operationalizes the precision discipline
// from B3 G2 as an ongoing signal: user feedback volume by item type, the most-
// flagged items (early warning of extraction degradation), and LLM error rates by
// stage. Internal only — never public. Reads the shared DB directly.

type TypeRow = { item_type: string; total: string; hidden: string; users: string }
type FlaggedRow = { docket_ref: string; item_type: string; reports: string; reason: string; item_ref: string }
type RecentRow = { when: string; item_type: string; docket_ref: string; reason: string; note: string }
type AnomalyRow = { stage: string; calls: string; errors: string; error_rate: string }

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export default async function AdminQaPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_qa" })

  // 1) Feedback volume by item_type (all-time). hidden = "not relevant" dismissals;
  //    users = distinct reporters (unique on user+type+ref, so count == reporters).
  const byTypeRaw = await safe(
    () =>
      db.execute(sql`
        SELECT item_type,
               count(*)::int                              AS total,
               count(*) FILTER (WHERE hides_item)::int    AS hidden,
               count(DISTINCT user_id)::int               AS users
        FROM extraction_feedback
        GROUP BY item_type
        ORDER BY total DESC
      `),
    [] as Record<string, unknown>[],
  )

  // 2) Most-flagged items — reports = number of distinct users who flagged it.
  //    docket_ref is the human-readable handle; item_ref is the stable hash/accession.
  const flaggedRaw = await safe(
    () =>
      db.execute(sql`
        SELECT coalesce(docket_ref, '—')                  AS docket_ref,
               item_type,
               count(*)::int                              AS reports,
               coalesce(max(reason), '—')                 AS reason,
               item_ref
        FROM extraction_feedback
        WHERE NOT hides_item
        GROUP BY docket_ref, item_type, item_ref
        HAVING count(*) >= 1
        ORDER BY reports DESC, max(created_at) DESC
        LIMIT 25
      `),
    [] as Record<string, unknown>[],
  )

  // 3) Recent feedback stream (last 25).
  const recentRaw = await safe(
    () =>
      db.execute(sql`
        SELECT created_at::date::text                     AS when,
               item_type,
               coalesce(docket_ref, '—')                  AS docket_ref,
               coalesce(reason, '—')                      AS reason,
               coalesce(note, '—')                        AS note
        FROM extraction_feedback
        ORDER BY created_at DESC
        LIMIT 25
      `),
    [] as Record<string, unknown>[],
  )

  // 4) Extraction anomalies — LLM error rate by stage (last 7 days).
  const anomalyRaw = await safe(
    () =>
      db.execute(sql`
        SELECT pipeline_stage                              AS stage,
               count(*)::int                              AS calls,
               count(*) FILTER (WHERE error IS NOT NULL)::int AS errors,
               round(100.0 * count(*) FILTER (WHERE error IS NOT NULL) / NULLIF(count(*), 0), 1) AS error_rate
        FROM llm_calls
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY pipeline_stage
        ORDER BY errors DESC, calls DESC
      `),
    [] as Record<string, unknown>[],
  )

  const byTypeRows: TypeRow[] = byTypeRaw.map(r => ({
    item_type: String(r.item_type),
    total:     String(r.total),
    hidden:    String(r.hidden),
    users:     String(r.users),
  }))

  const flaggedRows: FlaggedRow[] = flaggedRaw.map(r => ({
    docket_ref: String(r.docket_ref),
    item_type:  String(r.item_type),
    reports:    String(r.reports),
    reason:     String(r.reason),
    item_ref:   String(r.item_ref).slice(0, 12),
  }))

  const recentRows: RecentRow[] = recentRaw.map(r => ({
    when:       String(r.when),
    item_type:  String(r.item_type),
    docket_ref: String(r.docket_ref),
    reason:     String(r.reason),
    note:       String(r.note).slice(0, 60),
  }))

  const anomalyRows: AnomalyRow[] = anomalyRaw.map(r => ({
    stage:      String(r.stage),
    calls:      String(r.calls),
    errors:     String(r.errors),
    error_rate: r.error_rate != null ? `${r.error_rate}%` : "—",
  }))

  const totalFeedback = byTypeRows.reduce((n, r) => n + Number(r.total), 0)

  const byTypeColumns: DenseColumn<TypeRow>[] = [
    { key: "item_type", header: "Item type" },
    { key: "total", header: "Reports" },
    { key: "hidden", header: "Hidden (dismissals)" },
    { key: "users", header: "Distinct users" },
  ]

  const flaggedColumns: DenseColumn<FlaggedRow>[] = [
    { key: "docket_ref", header: "Docket / ref" },
    { key: "item_type", header: "Type" },
    {
      key: "reports",
      header: "Reports",
      render: val => {
        const n = Number(val)
        return (
          <span style={{ color: n > 1 ? "var(--np-danger)" : "var(--np-text-body)" }}>
            {String(val)}
          </span>
        )
      },
    },
    { key: "reason", header: "Reason" },
    { key: "item_ref", header: "Item hash" },
  ]

  const recentColumns: DenseColumn<RecentRow>[] = [
    { key: "when", header: "Date" },
    { key: "item_type", header: "Type" },
    { key: "docket_ref", header: "Docket / ref" },
    { key: "reason", header: "Reason" },
    { key: "note", header: "Note" },
  ]

  const anomalyColumns: DenseColumn<AnomalyRow>[] = [
    { key: "stage", header: "Pipeline stage" },
    { key: "calls", header: "Calls" },
    {
      key: "errors",
      header: "Errors",
      render: val => {
        const n = Number(val)
        return (
          <span style={{ color: n > 0 ? "var(--np-danger)" : "var(--np-text-muted)" }}>
            {String(val)}
          </span>
        )
      },
    },
    { key: "error_rate", header: "Error rate" },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Data quality
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          User feedback on extracted items + extraction anomalies.{" "}
          <span className="text-[var(--np-text-strong)] font-medium">{totalFeedback}</span> total reports.
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight mb-3">
          Feedback by type
        </h2>
        <DenseTable<TypeRow>
          columns={byTypeColumns}
          rows={byTypeRows}
          emptyMessage="No feedback recorded yet."
        />
      </div>

      <div className="mb-8">
        <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight mb-3">
          Most-flagged items
        </h2>
        <p className="text-[var(--np-text-muted)] text-[12px] mb-3">
          Items reported as wrong (not hidden — these stay visible to users). Multiple reporters → likely real extraction error.
        </p>
        <DenseTable<FlaggedRow>
          columns={flaggedColumns}
          rows={flaggedRows}
          emptyMessage="No flagged items."
        />
      </div>

      <div className="mb-8">
        <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight mb-3">
          Recent feedback
        </h2>
        <DenseTable<RecentRow>
          columns={recentColumns}
          rows={recentRows}
          emptyMessage="No feedback yet."
        />
      </div>

      <div>
        <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight mb-3">
          Extraction anomalies (LLM errors, last 7 days)
        </h2>
        <DenseTable<AnomalyRow>
          columns={anomalyColumns}
          rows={anomalyRows}
          emptyMessage="No LLM calls in the last 7 days."
        />
      </div>
    </div>
  )
}
