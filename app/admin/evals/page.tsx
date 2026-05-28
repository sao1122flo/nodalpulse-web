import { forbidden } from "next/navigation"
import { desc } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { evalRuns } from "@/db/schema"
import { requireAdmin } from "@/lib/auth/require-admin"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"
import { formatCT } from "@/lib/format-ct"

export const metadata: Metadata = { title: "Evals — Admin — NodalPulse" }

type EvalRow = {
  run_at: string
  model: string
  prompt_ver: string
  taxonomy_ver: string
  accuracy: string
  passed: string
  failed_tags: string
}

export default async function AdminEvalsPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  const runs = await db
    .select()
    .from(evalRuns)
    .orderBy(desc(evalRuns.runAt))
    .limit(20)

  const rows: EvalRow[] = runs.map(run => ({
    run_at: formatCT(run.runAt),
    model: run.model,
    prompt_ver: run.promptVer,
    taxonomy_ver: run.taxonomyVer,
    accuracy:
      run.overallAccuracy != null
        ? `${(Number(run.overallAccuracy) * 100).toFixed(1)}%`
        : "—",
    passed: run.passed ? "PASS" : "FAIL",
    failed_tags: run.failedTags.length > 0 ? run.failedTags.join(", ") : "—",
  }))

  const columns: DenseColumn<EvalRow>[] = [
    { key: "run_at", header: "Run at" },
    { key: "model", header: "Model" },
    { key: "prompt_ver", header: "Prompt" },
    { key: "taxonomy_ver", header: "Taxonomy" },
    { key: "accuracy", header: "Accuracy" },
    { key: "passed", header: "Result" },
    { key: "failed_tags", header: "Failed tags" },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Eval runs
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          Last 20 eval runs, newest first. Gate: 95% accuracy per tag.
        </p>
      </div>
      <DenseTable<EvalRow> columns={columns} rows={rows} emptyMessage="No eval runs found." />
    </div>
  )
}
