import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getEntitlements } from "@/lib/entitlements"
import {
  getTrackedDocketIds,
  getDeadlines,
  jurisdictionsForMarkets,
} from "@/app/(app)/dashboard/queries"
import { entitledMarketChips } from "./filters"
import { DeadlinesClient } from "./DeadlinesClient"

export const metadata: Metadata = { title: "Deadlines" }

// A dedicated page can carry more than the dashboard strip's 100-cap.
const DEADLINES_LIMIT = 500

export default async function DeadlinesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const today = new Date().toISOString().slice(0, 10)

  const ents = await getEntitlements(session.user.id)
  const entitledJurisdictions = jurisdictionsForMarkets(ents.marketAccess)
  const docketIds = await getTrackedDocketIds(session.user.id, false)

  // No tracked dockets → distinct empty state guiding to track (the client
  // handles the has-dockets-but-no-deadlines case).
  if (docketIds.length === 0) {
    return (
      <div className="px-6 py-8 max-w-[1080px] mx-auto">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight mb-6">
          Deadlines
        </h1>
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-6 py-10 text-center">
          <p className="text-[var(--np-text-muted)] text-[14px] mb-3">
            You&rsquo;re not tracking any matters yet.
          </p>
          <Link
            href="/dockets"
            className="text-[13px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Browse dockets to start tracking →
          </Link>
        </div>
      </div>
    )
  }

  const deadlines = await getDeadlines(docketIds, entitledJurisdictions, today, DEADLINES_LIMIT)
  const marketChips = entitledMarketChips(ents.marketAccess)

  return <DeadlinesClient deadlines={deadlines} marketChips={marketChips} today={today} />
}
