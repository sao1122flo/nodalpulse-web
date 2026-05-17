import { forbidden } from "next/navigation"
import { sql } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { db } from "@/db/client"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { getLlmCosts } from "@/lib/services-client"
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

type LlmCostRow = {
  day: string
  stage: string
  model: string
  calls: string
  cost_usd: string
}

const VALID_DAYS = [1, 7, 30, 90] as const

export default async function AdminCostPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_cost" })

  const sp = await searchParams
  const days = VALID_DAYS.includes(Number(sp.days) as (typeof VALID_DAYS)[number])
    ? Number(sp.days)
    : 7

  // Fetch LLM costs from services (cached 60s)
  let llmCosts: Awaited<ReturnType<typeof getLlmCosts>> | null = null
  try {
    llmCosts = await getLlmCosts(days)
  } catch {
    llmCosts = null
  }

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

  const llmCostRows: LlmCostRow[] =
    llmCosts?.ok
      ? llmCosts.value.by_day.map(row => ({
          day: row.day,
          stage: row.stage,
          model: row.model,
          calls: String(row.calls),
          cost_usd: `$${row.cost_usd.toFixed(4)}`,
        }))
      : []

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

  const llmCostColumns: DenseColumn<LlmCostRow>[] = [
    { key: "day", header: "Day" },
    { key: "stage", header: "Stage" },
    { key: "model", header: "Model" },
    { key: "calls", header: "Calls" },
    { key: "cost_usd", header: "Cost" },
  ]

  const dayPickerClass = (n: number) =>
    `text-[12px] px-2 py-0.5 rounded border transition-colors ${
      n === days
        ? "border-[var(--np-border-strong)] text-[var(--np-text-strong)] bg-[var(--np-surface-deep)]"
        : "border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
    }`

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Cost
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          Pipeline health and LLM spend.
        </p>
      </div>

      {/* LLM Costs */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[var(--np-text-primary)] text-base font-semibold tracking-tight">
            LLM Costs
          </h2>
          <div className="flex items-center gap-1">
            {VALID_DAYS.map(n => (
              <Link key={n} href={`?days=${n}`} className={dayPickerClass(n)}>
                {n}d
              </Link>
            ))}
          </div>
        </div>

        {llmCosts === null ? (
          <p className="text-[var(--np-danger)] text-[12px]">
            LLM cost data unavailable — services error.
          </p>
        ) : llmCosts.ok ? (
          <>
            <p className="text-[var(--np-text-muted)] text-[12px] mb-3">
              <span className="text-[var(--np-text-strong)] font-medium">
                ${llmCosts.value.totals.cost_usd.toFixed(4)}
              </span>
              {" "}total &middot;{" "}
              <span className="text-[var(--np-text-strong)] font-medium">
                {llmCosts.value.totals.calls}
              </span>
              {" "}calls &middot; {llmCosts.value.range.from} to {llmCosts.value.range.to}
            </p>
            <DenseTable<LlmCostRow>
              columns={llmCostColumns}
              rows={llmCostRows}
              emptyMessage="No LLM calls in this window."
            />
          </>
        ) : (
          <p className="text-[var(--np-danger)] text-[12px]">
            LLM cost data unavailable — services error.
          </p>
        )}
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
