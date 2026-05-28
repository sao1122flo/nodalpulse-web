import { forbidden } from "next/navigation"
import { sql } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/db/client"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { DenseTable } from "@/components/dense-table"
import type { DenseColumn } from "@/components/dense-table"
import { formatDateCT } from "@/lib/format-ct"
import { RecomposeButton } from "./RecomposeButton"

export const metadata: Metadata = { title: "Users — Admin — NodalPulse" }

type UserRow = {
  id: string
  email: string
  name: string
  emailVerified: string
  plan: string
  roles: string
  lastSession: string
  signedUp: string
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_users" })

  const raw = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.email_verified,
      u.created_at,
      up.market_roles,
      s.status AS subscription_status,
      MAX(sess.created_at) AS last_session_at
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN subscriptions s ON s.user_id = u.id
    LEFT JOIN sessions sess ON sess.user_id = u.id
    GROUP BY u.id, u.email, u.name, u.email_verified, u.created_at, up.market_roles, s.status
    ORDER BY u.created_at DESC
  `)

  const rows: UserRow[] = raw.map(row => ({
    id: String(row.id),
    email: String(row.email),
    name: row.name != null ? String(row.name) : "—",
    emailVerified: row.email_verified ? "yes" : "no",
    plan: row.subscription_status != null ? String(row.subscription_status) : "none",
    roles:
      Array.isArray(row.market_roles) && (row.market_roles as string[]).length > 0
        ? (row.market_roles as string[]).join(", ")
        : "—",
    lastSession:
      row.last_session_at != null
        ? formatDateCT(new Date(String(row.last_session_at)))
        : "—",
    signedUp: formatDateCT(new Date(String(row.created_at))),
  }))

  const columns: DenseColumn<UserRow>[] = [
    { key: "email", header: "Email" },
    { key: "name", header: "Name" },
    {
      key: "emailVerified",
      header: "Verified",
      render: val => (
        <span style={{ color: val === "yes" ? "var(--np-text-muted)" : "var(--np-danger)" }}>
          {String(val)}
        </span>
      ),
    },
    { key: "plan", header: "Plan" },
    { key: "roles", header: "Market roles" },
    { key: "lastSession", header: "Last session" },
    { key: "signedUp", header: "Signed up" },
    {
      key: "id",
      header: "Actions",
      render: (_val, row) => <RecomposeButton userId={row.id} />,
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Users
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          {rows.length} user{rows.length !== 1 ? "s" : ""}. Last session is the most recent
          session row, not a dedicated last-active field.
        </p>
      </div>

      <DenseTable<UserRow>
        columns={columns}
        rows={rows}
        emptyMessage="No users found."
      />
    </div>
  )
}
