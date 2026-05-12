import { forbidden } from "next/navigation"
import { createHash } from "crypto"
import { desc, eq } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { adminActions } from "@/db/schema"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"

export const metadata: Metadata = { title: "Admin — NodalPulse" }

type StatusRow = {
  email_hash: string
  last_seen: string
  build_sha: string
}

export default async function AdminIndexPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_index" })

  const emailHash = createHash("sha256").update(admin.email).digest("hex")

  const [lastRow] = await db
    .select({ createdAt: adminActions.createdAt })
    .from(adminActions)
    .where(eq(adminActions.actorEmailHash, emailHash))
    .orderBy(desc(adminActions.createdAt))
    .offset(1)
    .limit(1)

  const buildSha = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"

  const rows: StatusRow[] = [
    {
      email_hash: emailHash.slice(0, 16) + "…",
      last_seen: lastRow?.createdAt
        ? lastRow.createdAt.toISOString().replace("T", " ").slice(0, 19) + " UTC"
        : "first visit",
      build_sha: buildSha,
    },
  ]

  const columns: DenseColumn<StatusRow>[] = [
    { key: "email_hash", header: "Actor (hash)" },
    { key: "last_seen", header: "Last seen" },
    { key: "build_sha", header: "Build" },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Admin
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          Access restricted. All visits are logged.
        </p>
      </div>
      <DenseTable<StatusRow> columns={columns} rows={rows} />
    </div>
  )
}
