import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { briefs } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getObject } from "@/lib/r2"
import BriefFrame from "@/app/(app)/dashboard/BriefFrame"
import { ReloadButton } from "@/app/(app)/dashboard/ReloadButton"

export const metadata: Metadata = { title: "Brief" }

function formatDate(dateStr: string): string {
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

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

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
    .where(and(eq(briefs.id, id), eq(briefs.userId, session.user.id)))
    .limit(1)

  if (!brief) notFound()

  let briefHtml: string | null = null
  if (brief.htmlR2Key) {
    try {
      briefHtml = await getObject(brief.htmlR2Key)
    } catch {
      briefHtml = null
    }
  }

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Back link */}
      <div className="mb-5">
        <Link
          href="/briefs"
          className="text-[var(--np-text-muted)] text-[13px] hover:text-[var(--np-text-body)] transition-colors"
        >
          &larr; Brief History
        </Link>
      </div>

      {/* Brief card */}
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
            {brief.sendStatus.charAt(0).toUpperCase() + brief.sendStatus.slice(1)}
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
                Brief content unavailable — check your email for this brief.
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

      <p className="text-[var(--np-text-muted)] text-[12px] mt-4">
        Saw a docket worth following?{" "}
        <a href="/dockets" className="text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors">
          Track it in Dockets &rarr;
        </a>
      </p>
    </div>
  )
}
