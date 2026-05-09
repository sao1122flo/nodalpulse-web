import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export const metadata: Metadata = { title: "Dockets" }

export default async function DocketsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  return (
    <div className="px-8 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Dockets
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          Track specific PUCT dockets for targeted coverage in your daily brief.
        </p>
      </div>

      {/* Coming soon card */}
      <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-12 text-center">
        <div className="w-10 h-10 rounded-full border border-[var(--np-border-strong)] bg-[var(--np-surface-deep)] flex items-center justify-center mx-auto mb-4">
          <span className="text-[var(--np-text-muted)] text-base">&#9632;</span>
        </div>
        <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-2">
          Docket tracking coming soon
        </h2>
        <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed">
          Pin specific PUCT docket numbers here and your brief will always
          include their latest filings — even on quiet days.
        </p>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-4">
          You can add docket numbers during{" "}
          <a
            href="/onboarding"
            className="text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            account setup
          </a>
          {" "}in the meantime.
        </p>
      </div>
    </div>
  )
}
