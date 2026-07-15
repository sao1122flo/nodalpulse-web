import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getEntitlements } from "@/lib/entitlements"
import { getQnaUsage } from "@/lib/services-client"
import { db } from "@/db/client"
import { userProfiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { ChatClient } from "./ChatClient"
import { TrialBanner } from "@/app/(app)/components/TrialBanner"

export const metadata: Metadata = { title: "Ask the Record" }

export default async function ChatPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login?callbackURL=%2Fchat")

  const userId = session.user.id
  const [ents, profileRows] = await Promise.all([
    getEntitlements(userId),
    db
      .select({ marketRoles: userProfiles.marketRoles })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1),
  ])

  // Monthly AI-action quota (null = unlimited). Free now includes AI (3/mo), so this
  // "blocked" branch effectively never fires — kept only as a defensive fallback.
  const limitPerDay = ents.aiActions.perMonth ?? 1_000_000
  const marketRoles: string[] = profileRows[0]?.marketRoles ?? []

  if (limitPerDay === 0) {
    return (
      <div className="px-8 py-8 max-w-2xl">
        <TrialBanner />
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight mb-2">
          Q&A
        </h1>
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-10 text-center mt-6">
          <p className="text-[var(--np-text-strong)] font-medium text-[14px] mb-2">
            Q&A is available on paid plans
          </p>
          <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed mb-6">
            Ask questions about your tracked filings and get cited answers.
          </p>
          <a
            href={`/pricing?tier=pro&return=%2Fchat`}
            className="
              inline-flex items-center justify-center
              h-10 px-5 rounded-[var(--np-radius-md)]
              bg-[var(--np-accent)] text-[var(--np-accent-fg)]
              text-[13px] font-medium
              hover:bg-[var(--np-accent-hover)] transition-colors
            "
          >
            View plans →
          </a>
        </div>
      </div>
    )
  }

  // Fetch today's usage — best-effort (don't fail the page if services is down)
  let usedToday = 0
  try {
    const usageResult = await getQnaUsage(userId)
    if (usageResult.ok) usedToday = usageResult.value.used_today
  } catch {
    // non-fatal
  }

  return (
    <div className="px-8 py-8 max-w-3xl flex flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>
      <TrialBanner />
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Q&A
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          Ask questions about your tracked filings.
        </p>
      </div>
      <div className="flex-1 flex flex-col">
        <ChatClient
          initialLimit={limitPerDay}
          usedToday={usedToday}
          marketRoles={marketRoles}
        />
      </div>
    </div>
  )
}
