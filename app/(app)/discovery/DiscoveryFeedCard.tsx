"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { JurisdictionBadge } from "@/app/(app)/dashboard/components/JurisdictionBadge"
import { trackDocket } from "@/app/(app)/dockets/actions"
import { dismissDiscoveryItem } from "./actions"
import type { DiscoveryFeedItem } from "./queries"

function docTypeLabel(t: string): string {
  return t.replace(/^ferc-/, "").replace(/-/g, " ")
}

export function DiscoveryFeedCard({ item }: { item: DiscoveryFeedItem }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [track, setTrack] = useState<"idle" | "tracking" | "tracked" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)

  const primaryDocket = item.docketNumbers[0] ?? ""
  const isNew = item.daysAgo <= 7

  if (removed) return null

  function handleTrack() {
    if (!primaryDocket || isPending || track === "tracked") return
    setTrack("tracking")
    setErrorMsg(null)
    startTransition(async () => {
      const res = await trackDocket({ docketNumber: primaryDocket })
      if (res.ok) {
        setTrack("tracked")
        // Tracking moves the matter into monitoring → it leaves Discovery.
        setTimeout(() => { setRemoved(true); router.refresh() }, 600)
      } else {
        setTrack("error")
        setErrorMsg(res.error ?? "Could not track docket.")
      }
    })
  }

  function handleDismiss() {
    if (isPending) return
    startTransition(async () => {
      await dismissDiscoveryItem(item.accession)
      setRemoved(true)
      router.refresh()
    })
  }

  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
      {/* Title */}
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-[14px] text-[var(--np-text-primary)] font-medium leading-snug min-w-0">
          {item.description}
        </p>
        {isNew && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(34,197,94,0.10)] text-[var(--np-success)] border border-[rgba(34,197,94,0.30)]">
            New
          </span>
        )}
      </div>

      {/* Meta: market dot + docket + age + not-tracked */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--np-text-muted)] mb-2.5">
        <JurisdictionBadge jurisdiction="FERC" />
        {primaryDocket && <span className="font-medium text-[var(--np-text-body)]">{primaryDocket}</span>}
        <span>· {docTypeLabel(item.docType)}</span>
        <span>· {item.daysAgo === 0 ? "today" : item.daysAgo === 1 ? "1 day ago" : `${item.daysAgo} days ago`}</span>
        <span className="px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] border border-[var(--np-border)]">not tracked</span>
      </div>

      {/* Matches: theme tags */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className="text-[11px] text-[var(--np-text-muted)]">Matches:</span>
        {item.themes.map(th => (
          <span
            key={th.key}
            className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--np-accent-fill)] text-[var(--np-accent-text)] border border-[rgba(99,102,241,0.25)]"
          >
            {th.label}
          </span>
        ))}
      </div>

      {/* Evidence snippet — the trust layer (verbatim or omitted) */}
      {item.themes.find(t => t.evidence)?.evidence && (
        <p className="text-[12px] text-[var(--np-text-body)] italic leading-snug border-l-2 border-[var(--np-border-strong)] pl-3 my-2">
          “{item.themes.find(t => t.evidence)!.evidence}”
        </p>
      )}

      {errorMsg && <p className="text-[11px] text-[var(--np-danger)] mt-1">{errorMsg}</p>}

      {/* Footer actions */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--np-border)]">
        {primaryDocket ? (
          <button
            type="button"
            onClick={handleTrack}
            disabled={isPending || track === "tracked"}
            className={`h-7 px-3 rounded-[var(--np-radius-sm)] text-[12px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
              track === "tracked"
                ? "bg-[rgba(34,197,94,0.12)] text-[var(--np-success)] border border-[rgba(34,197,94,0.2)]"
                : "bg-[var(--np-accent)] text-white hover:bg-[var(--np-accent-hover)] disabled:opacity-40"
            }`}
          >
            {track === "tracking" ? "Tracking…" : track === "tracked" ? "Tracking ✓" : "Track this"}
          </button>
        ) : (
          <Link href="/dockets" className="text-[12px] font-medium text-[var(--np-accent-text)] hover:underline">
            Track this →
          </Link>
        )}

        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-accent-text)] transition-colors"
          >
            <ExternalLink size={13} /> source
          </a>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="ml-auto text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors cursor-pointer disabled:opacity-40"
        >
          Not relevant
        </button>
      </div>
    </div>
  )
}
