import { forbidden } from "next/navigation"
import { desc, inArray, like } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { jobs, jobResults } from "@/db/schema"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"
import { formatCT } from "@/lib/format-ct"

export const metadata: Metadata = { title: "Crawls — Admin — NodalPulse" }

type CrawlRow = {
  kind: string
  status: string
  attempts: string
  duration_ms: string
  success: string
  error: string
  created_at: string
}

export default async function AdminCrawlsPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_crawls" })

  const recentJobs = await db
    .select()
    .from(jobs)
    .where(like(jobs.kind, "crawl-%"))
    .orderBy(desc(jobs.createdAt))
    .limit(50)

  const jobIds = recentJobs.map(j => j.id)

  const results =
    jobIds.length > 0
      ? await db
          .select()
          .from(jobResults)
          .where(inArray(jobResults.jobId, jobIds))
          .orderBy(desc(jobResults.finishedAt))
      : []

  const resultMap = new Map<string, (typeof results)[0]>()
  for (const r of results) {
    if (!resultMap.has(r.jobId)) resultMap.set(r.jobId, r)
  }

  const rows: CrawlRow[] = recentJobs.map(job => {
    const latest = resultMap.get(job.id)
    return {
      kind: job.kind,
      status: job.status,
      attempts: String(job.attempts),
      duration_ms: latest?.durationMs != null ? `${latest.durationMs}ms` : "—",
      success: latest ? (latest.success ? "pass" : "fail") : "—",
      error: job.error ?? "—",
      created_at: formatCT(job.createdAt),
    }
  })

  const columns: DenseColumn<CrawlRow>[] = [
    { key: "kind", header: "Kind" },
    { key: "status", header: "Status" },
    { key: "attempts", header: "Att." },
    { key: "duration_ms", header: "Duration" },
    { key: "success", header: "Result" },
    {
      key: "error",
      header: "Error",
      tdClassName: "max-w-[200px]",
      render: val => {
        const s = String(val)
        return s === "—" ? (
          <span className="text-[var(--np-text-muted)]">{s}</span>
        ) : (
          <span className="block truncate" title={s}>
            {s}
          </span>
        )
      },
    },
    { key: "created_at", header: "Created" },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Crawl jobs
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          Last 50 crawl.* jobs, newest first.
        </p>
      </div>
      <DenseTable<CrawlRow> columns={columns} rows={rows} emptyMessage="No crawl jobs found." />
    </div>
  )
}
