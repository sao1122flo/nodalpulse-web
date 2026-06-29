import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getEntitlements } from "@/lib/entitlements"
import { getDiscoveryHits } from "@/app/(app)/dashboard/queries"
import { DiscoveryPanel } from "@/app/(app)/dashboard/components/DiscoveryPanel"
import { getThemes, getWatchedThemeKeys, getDiscoveryThemeFeed } from "./queries"
import { DiscoveryClient } from "./DiscoveryClient"

export const metadata: Metadata = { title: "Discovery" }

export default async function DiscoveryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const ents = await getEntitlements(session.user.id)

  // Available to any active paid/trial user (any market). FERC theme discovery is
  // the base ICP's best differentiator — deliberately NOT gated behind CAISO/PJM.
  if (ents.marketAccess.length === 0) {
    return (
      <div className="px-6 py-8 max-w-[900px] mx-auto">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight mb-6">Discovery</h1>
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-12 text-center">
          <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-2">Discovery is a paid feature</h2>
          <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed">
            Surface new FERC matters that match the themes you care about — even in dockets you don&rsquo;t track yet.
          </p>
          <Link href="/pricing" className="inline-block mt-4 text-[13px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors">
            See plans →
          </Link>
        </div>
      </div>
    )
  }

  const [themes, watchedKeys] = await Promise.all([
    getThemes(),
    getWatchedThemeKeys(session.user.id),
  ])
  const [items, discovery] = await Promise.all([
    getDiscoveryThemeFeed(session.user.id, watchedKeys, 30),
    getDiscoveryHits(session.user.id),
  ])

  return (
    <>
      <DiscoveryClient themes={themes} watchedKeys={watchedKeys} items={items} />

      {/* ── Secondary: entity "Mentions" (names you watch) ── */}
      <div className="px-6 pb-12 max-w-[900px] mx-auto">
        <div className="border-t border-[var(--np-border)] pt-6">
          <DiscoveryPanel hits={discovery.hits} />
        </div>
      </div>
    </>
  )
}
