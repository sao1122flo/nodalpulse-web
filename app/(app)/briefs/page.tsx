import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { briefs } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

export const metadata: Metadata = { title: "Brief History" }

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z")
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatSentAt(ts: Date | null): string {
  if (!ts) return "—"
  return ts.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  })
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-[rgba(34,197,94,0.12)] text-[var(--np-success)] border-[rgba(34,197,94,0.2)]",
  pending: "bg-[rgba(251,191,36,0.1)] text-[var(--np-deadline)] border-[rgba(251,191,36,0.2)]",
  failed: "bg-[rgba(239,68,68,0.1)] text-[var(--np-danger)] border-[rgba(239,68,68,0.2)]",
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default async function BriefsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const allBriefs = await db
    .select()
    .from(briefs)
    .where(eq(briefs.userId, session.user.id))
    .orderBy(desc(briefs.date))

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Brief History
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          All briefs generated for your account.
        </p>
      </div>

      {allBriefs.length === 0 ? (
        <div
          className="
            rounded-[var(--np-radius-lg)] border border-[var(--np-border)]
            bg-[var(--np-surface-elevated)]
            px-8 py-12 text-center
          "
        >
          <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-1">
            No briefs yet
          </h2>
          <p className="text-[var(--np-text-muted)] text-[13px]">
            Your briefs will appear here once generated.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--np-border)]">
                  {["Date", "Items", "Status", "Sent At"].map(col => (
                    <th
                      key={col}
                      className="
                        px-4 py-2.5 text-left
                        text-[var(--np-text-muted)] text-[11px] font-medium uppercase tracking-wide
                      "
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allBriefs.map(brief => (
                  <tr
                    key={brief.id}
                    className="border-b border-[var(--np-border)] last:border-0"
                    style={{ height: "40px" }}
                  >
                    <td className="px-4 py-0 text-[var(--np-text-strong)] font-medium">
                      <Link
                        href={`/briefs/${brief.id}`}
                        className="hover:text-[var(--np-accent-text)] transition-colors"
                      >
                        {formatDate(brief.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-0 text-[var(--np-text-body)]">
                      {brief.citationCount}
                    </td>
                    <td className="px-4 py-0">
                      <StatusBadge status={brief.sendStatus} />
                    </td>
                    <td className="px-4 py-0 text-[var(--np-text-body)]">
                      {formatSentAt(brief.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden flex flex-col gap-2">
            {allBriefs.map(brief => (
              <Link
                key={brief.id}
                href={`/briefs/${brief.id}`}
                className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-3 block hover:border-[var(--np-border-strong)] transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-[var(--np-text-strong)] font-medium text-[14px]">
                    {formatDate(brief.date)}
                  </p>
                  <StatusBadge status={brief.sendStatus} />
                </div>
                <p className="text-[var(--np-text-muted)] text-[12px]">
                  {brief.citationCount} item{brief.citationCount !== 1 ? "s" : ""}
                  {" · "}
                  {formatSentAt(brief.sentAt)}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
