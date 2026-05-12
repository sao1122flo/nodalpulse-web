import { forbidden } from "next/navigation"
import { sql } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"

export const metadata: Metadata = { title: "Cost — Admin — NodalPulse" }

type ThroughputRow = {
  kind: string
  total: string
  success_rate: string
  consec_fail: string
}

type DurationRow = {
  kind: string
  avg_ms: string
  p95_ms: string
  max_ms: string
}

type DailyRow = {
  day: string
  total: string
  successes: string
}

export default async function AdminCostPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_cost" })

  // Consecutive failures: for each kind, count how many of the most recent results
  // (newest first) are failures before the first success. 0 = healthy.
  const throughputRaw = await db.execute(sql`
    WITH ranked AS (
      SELECT
        j.kind,
        jr.success,
        ROW_NUMBER() OVER (PARTITION BY j.kind ORDER BY jr.finished_at DESC) AS rn
      FROM job_results jr
      JOIN jobs j ON j.id = jr.job_id
    ),
    first_success AS (
      SELECT kind, MIN(rn) AS rn
      FROM ranked
      WHERE success = true
      GROUP BY kind
    ),
    totals AS (
      SELECT kind, MAX(rn)::int AS cnt
      FROM ranked
      GROUP BY kind
    )
    SELECT
      r.kind,
      totals.cnt AS total,
      SUM(CASE WHEN r.success THEN 1 ELSE 0 END)::int AS successes,
      ROUND(100.0 * SUM(CASE WHEN r.success THEN 1 ELSE 0 END) / totals.cnt, 1) AS success_pct,
      COALESCE(fs.rn - 1, totals.cnt)::int AS consecutive_failures
    FROM ranked r
    LEFT JOIN first_success fs ON r.kind = fs.kind
    JOIN totals ON r.kind = totals.kind
    GROUP BY r.kind, fs.rn, totals.cnt
    ORDER BY consecutive_failures DESC, r.kind
  `)

  const durationRaw = await db.execute(sql`
    SELECT
      j.kind,
      AVG(jr.duration_ms)::int AS avg_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY jr.duration_ms)::int AS p95_ms,
      MAX(jr.duration_ms) AS max_ms
    FROM job_results jr
    JOIN jobs j ON j.id = jr.job_id
    WHERE jr.duration_ms IS NOT NULL
    GROUP BY j.kind
    ORDER BY avg_ms DESC
  `)

  const dailyRaw = await db.execute(sql`
    SELECT
      DATE_TRUNC('day', jr.finished_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*)::int AS total,
      SUM(CASE WHEN jr.success THEN 1 ELSE 0 END)::int AS successes
    FROM job_results jr
    WHERE jr.finished_at >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day DESC
  `)

  const throughputRows: ThroughputRow[] = throughputRaw.map(row => ({
    kind: String(row.kind),
    total: String(row.total),
    success_rate: row.success_pct != null ? `${row.success_pct}%` : "—",
    consec_fail: String(row.consecutive_failures),
  }))

  const durationRows: DurationRow[] = durationRaw.map(row => ({
    kind: String(row.kind),
    avg_ms: row.avg_ms != null ? `${row.avg_ms}ms` : "—",
    p95_ms: row.p95_ms != null ? `${row.p95_ms}ms` : "—",
    max_ms: row.max_ms != null ? `${row.max_ms}ms` : "—",
  }))

  const dailyRows: DailyRow[] = dailyRaw.map(row => ({
    day: String(row.day),
    total: String(row.total),
    successes: String(row.successes),
  }))

  const throughputColumns: DenseColumn<ThroughputRow>[] = [
    { key: "kind", header: "Kind" },
    { key: "total", header: "Total" },
    { key: "success_rate", header: "Success rate" },
    {
      key: "consec_fail",
      header: "Consec. fails",
      render: val => {
        const n = Number(val)
        return (
          <span style={{ color: n > 0 ? "var(--np-danger)" : "var(--np-text-muted)" }}>
            {String(val)}
          </span>
        )
      },
    },
  ]

  const durationColumns: DenseColumn<DurationRow>[] = [
    { key: "kind", header: "Kind" },
    { key: "avg_ms", header: "Avg" },
    { key: "p95_ms", header: "p95" },
    { key: "max_ms", header: "Max" },
  ]

  const dailyColumns: DenseColumn<DailyRow>[] = [
    { key: "day", header: "Day (UTC)" },
    { key: "total", header: "Jobs" },
    { key: "successes", header: "Successes" },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Cost
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          Pipeline health. LLM cost section pending services instrumentation.
        </p>
      </div>

      <div className="mb-8 rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] p-4">
        <p className="text-[var(--np-text-body)] text-[12px] mb-2">
          LLM cost tracking is not yet instrumented. When{" "}
          <code className="font-mono">nodalpulse-services</code> writes the{" "}
          <code className="font-mono">usage</code> block below to{" "}
          <code className="font-mono">job_results.output</code> for every LLM-touching
          job, cost tables will populate automatically:
        </p>
        <pre className="text-[var(--np-text-body)] text-[12px] bg-[var(--np-surface-deep)] rounded p-3 overflow-x-auto leading-relaxed">
{`{
  usage: {
    model: string,
    input_tokens: number,
    output_tokens: number,
    cache_creation_input_tokens: number,
    cache_read_input_tokens: number,
    cost_usd: number   // computed services-side from the current pricing table
  }
}`}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight mb-3">
          Throughput
        </h2>
        <DenseTable<ThroughputRow>
          columns={throughputColumns}
          rows={throughputRows}
          emptyMessage="No job results found."
        />
      </div>

      <div className="mb-8">
        <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight mb-3">
          Duration
        </h2>
        <DenseTable<DurationRow>
          columns={durationColumns}
          rows={durationRows}
          emptyMessage="No duration data."
        />
      </div>

      <div>
        <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight mb-3">
          Daily activity (last 7 days)
        </h2>
        <DenseTable<DailyRow>
          columns={dailyColumns}
          rows={dailyRows}
          emptyMessage="No activity in the last 7 days."
        />
      </div>
    </div>
  )
}
