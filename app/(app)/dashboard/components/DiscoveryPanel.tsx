"use client"

import { useTransition, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { DiscoveryHit } from "../queries"
import { trackDocket } from "@/app/(app)/dockets/actions"

// ---------------------------------------------------------------------------
// DiscoveryPanel — rolling 30-day entity mention feed (#85)
// Server component wrapper calls getDiscoveryHits; this is the client island.
// ---------------------------------------------------------------------------

export function DiscoveryPanel({ hits }: { hits: DiscoveryHit[] }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-1">
        <h2 className="text-[var(--np-text-primary)] text-[15px] font-semibold">
          Mentions of your entities
        </h2>
        <span className="text-[12px] text-[var(--np-text-muted)]">· Last 30 days</span>
      </div>
      <p className="text-[12px] text-[var(--np-text-muted)] mb-4 leading-relaxed">
        Surfaced because a name you watch appears in these filings. Metadata only — track a docket for full analysis.
      </p>
      {hits.length === 0 ? (
        <p className="text-[13px] text-[var(--np-text-muted)] py-2">
          No entity mentions in the last 30 days.{" "}
          <Link href="/settings?tab=entities" className="text-[var(--np-accent-text)] hover:underline">
            Add more names or subsidiaries →
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {hits.map(hit => (
              <DiscoveryHitCard key={hit.accession} hit={hit} />
            ))}
          </div>
          <p className="text-[11px] text-[var(--np-text-muted)] mt-3">
            Not seeing a filing?{" "}
            <Link href="/settings?tab=entities" className="text-[var(--np-accent-text)] hover:underline">
              Add more names or subsidiaries →
            </Link>
          </p>
        </>
      )}
    </section>
  )
}

function DiscoveryHitCard({ hit }: { hit: DiscoveryHit }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "tracking" | "tracked" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const primaryDocket = hit.docketNumbers[0] ?? ""

  function handleTrack() {
    if (!primaryDocket || isPending || status === "tracked") return
    setStatus("tracking")
    setErrorMsg(null)
    startTransition(async () => {
      const result = await trackDocket({ docketNumber: primaryDocket })
      if (result.ok) {
        setStatus("tracked")
        router.refresh()
      } else {
        setStatus("error")
        setErrorMsg(result.error ?? "Could not track docket.")
      }
    })
  }

  return (
    <div className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[var(--np-text-primary)] font-medium leading-snug mb-1 line-clamp-2">
            {hit.description}
          </p>
          <p className="text-[11px] text-[var(--np-text-muted)]">
            {hit.docketNumbers.slice(0, 2).join(", ")}
            {hit.filedAt ? ` · ${hit.filedAt}` : ""}
            {hit.filerNames.length > 0
              ? ` · ${hit.filerNames.slice(0, 2).join(", ")}`
              : ""}
          </p>
          {status === "error" && errorMsg && (
            <p className="text-[11px] text-[var(--np-danger)] mt-1">{errorMsg}</p>
          )}
        </div>

        {primaryDocket ? (
          <button
            type="button"
            onClick={handleTrack}
            disabled={isPending || status === "tracked"}
            className={`
              shrink-0 h-7 px-3 rounded-[var(--np-radius-sm)]
              text-[12px] font-medium transition-colors
              cursor-pointer disabled:cursor-not-allowed
              ${status === "tracked"
                ? "bg-[rgba(34,197,94,0.12)] text-[var(--np-success)] border border-[rgba(34,197,94,0.2)]"
                : "border border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-accent-text)] hover:border-[var(--np-accent)] disabled:opacity-40"
              }
            `}
          >
            {status === "tracking"
              ? "Tracking…"
              : status === "tracked"
              ? "Tracking ✓"
              : "Track this"}
          </button>
        ) : (
          <Link
            href="/dockets"
            className="shrink-0 text-[12px] font-medium text-[var(--np-accent-text)] hover:underline whitespace-nowrap"
          >
            Track this →
          </Link>
        )}
      </div>
    </div>
  )
}
