import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { briefs } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getObject } from "@/lib/r2"
import { BRIEF_DELIVERY_COPY } from "@/lib/copy"
import { SAMPLE_BRIEF_HTML } from "@/lib/sample-brief"
import BriefFrame from "./BriefFrame"
import { ReloadButton } from "./ReloadButton"
import { RequestBriefButton } from "./RequestBriefButton"

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

  const todayIso = new Date().toISOString().slice(0, 10)

  const [brief] = await db
    .select({
      id: briefs.id,
      date: briefs.date,
      model: briefs.model,
      promptVer: briefs.promptVer,
      htmlR2Key: briefs.htmlR2Key,
      citationCount: briefs.citationCount,
      sendStatus: briefs.sendStatus,
      sentAt: briefs.sentAt,
    })
    .from(briefs)
    .where(
      and(
        eq(briefs.userId, session.user.id),
        eq(briefs.sendStatus, "sent"),
      ),
    )
    .orderBy(desc(briefs.date))
    .limit(1)

  let briefHtml: string | null = null
  if (brief?.htmlR2Key) {
    try {
      briefHtml = await getObject(brief.htmlR2Key)
    } catch {
      briefHtml = null
    }
  }

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
            {briefHtml ? (
              <BriefFrame html={briefHtml} />
            ) : (
              <div
                className="
                  rounded-[var(--np-radius-md)] border border-[var(--np-border)]
                  bg-[var(--np-surface-deep)] px-4 py-4
                "
              >
                <p className="text-[var(--np-text-muted)] text-[13px] leading-relaxed">
                  Brief content unavailable — check your email for today&apos;s brief.
                </p>
                {brief.model && (
                  <p className="text-[var(--np-text-muted)] text-[11px] mt-2 font-mono">
                    model: {brief.model}
                    {brief.promptVer ? ` · prompt: ${brief.promptVer}` : ""}
                  </p>
                )}
                <ReloadButton />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty state — show sample brief so new users see something compelling */
        <div>
          <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-[var(--np-border)] flex items-start justify-between gap-4">
              <div>
                <p className="text-[var(--np-text-primary)] font-medium text-[14px]">
                  Example brief
                </p>
                <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                  {BRIEF_DELIVERY_COPY}
                </p>
              </div>
              <span
                className="
                  inline-flex items-center px-2 py-0.5 rounded-full
                  text-[11px] font-medium
                  bg-[rgba(245,158,11,0.12)] text-[#92400E]
                  border border-[rgba(245,158,11,0.3)]
                  flex-shrink-0
                "
              >
                Sample
              </span>
            </div>

            {/* Card body */}
            <div className="px-5 py-5">
              <BriefFrame html={SAMPLE_BRIEF_HTML} />
            </div>
          </div>

          <RequestBriefButton date={todayIso} />
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
