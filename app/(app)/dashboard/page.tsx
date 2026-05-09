import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { briefs } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"

export const metadata: Metadata = { title: "Dashboard" }

function formatDate(dateStr: string): string {
  // dateStr is a date column value, e.g. "2026-05-09"
  const d = new Date(dateStr + "T12:00:00Z")
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
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

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const [brief] = await db
    .select()
    .from(briefs)
    .where(
      and(
        eq(briefs.userId, session.user.id),
        eq(briefs.sendStatus, "sent"),
      ),
    )
    .orderBy(desc(briefs.date))
    .limit(1)

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Today&apos;s Brief
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          Signed in as{" "}
          <span className="text-[var(--np-text-body)]">{session.user.email}</span>
        </p>
      </div>

      {brief ? (
        /* Brief card */
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
          {/* Card header */}
          <div className="px-5 py-4 border-b border-[var(--np-border)] flex items-start justify-between gap-4">
            <div>
              <p className="text-[var(--np-text-primary)] font-medium text-[14px]">
                {formatDate(brief.date)}
              </p>
              <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                {brief.citationCount} item{brief.citationCount !== 1 ? "s" : ""}
                {" · "}
                sent at {formatSentAt(brief.sentAt)}
              </p>
            </div>
            <span
              className="
                inline-flex items-center px-2 py-0.5 rounded-full
                text-[11px] font-medium
                bg-[rgba(34,197,94,0.12)] text-[var(--np-success)]
                border border-[rgba(34,197,94,0.2)]
                flex-shrink-0
              "
            >
              Sent
            </span>
          </div>

          {/* Card body */}
          <div className="px-5 py-5">
            <div
              className="
                rounded-[var(--np-radius-md)] border border-[var(--np-border)]
                bg-[var(--np-surface-deep)] px-4 py-4
              "
            >
              <p className="text-[var(--np-text-muted)] text-[13px] leading-relaxed">
                Full brief content rendering coming soon — check your email for
                today&apos;s brief.
              </p>
              {brief.model && (
                <p className="text-[var(--np-text-muted)] text-[11px] mt-2 font-mono">
                  model: {brief.model}
                  {brief.promptVer ? ` · prompt: ${brief.promptVer}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div
          className="
            rounded-[var(--np-radius-lg)] border border-[var(--np-border)]
            bg-[var(--np-surface-elevated)]
            px-8 py-12 text-center
          "
        >
          <div
            className="
              w-10 h-10 rounded-full border border-[var(--np-border-strong)]
              bg-[var(--np-surface-deep)]
              flex items-center justify-center mx-auto mb-4
            "
          >
            <span className="text-[var(--np-text-muted)] text-base">&#9632;</span>
          </div>
          <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-1">
            No brief yet
          </h2>
          <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed">
            Your first brief is being generated. It will appear here and land in
            your inbox once ready — typically within a few minutes of account
            setup.
          </p>
        </div>
      )}

      {/* Brief History link */}
      <div className="mt-4">
        <Link
          href="/briefs"
          className="text-[var(--np-accent-text)] text-[13px] hover:text-[var(--np-accent-hover)] transition-colors"
        >
          View brief history &rarr;
        </Link>
      </div>
    </div>
  )
}
