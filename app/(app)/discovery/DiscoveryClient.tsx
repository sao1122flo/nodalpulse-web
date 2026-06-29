"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { DiscoveryFeedCard } from "./DiscoveryFeedCard"
import { addWatchedTheme, removeWatchedTheme, requestTheme } from "./actions"
import type { Theme, DiscoveryFeedItem } from "./queries"

const RECENCY = [
  { key: 7,  label: "Last 7 days" },
  { key: 30, label: "Last 30 days" },
] as const

// Optional docket-prefix refinement (all FERC families in discovery_feed).
const PREFIXES = ["ER", "EL", "RM", "RD", "RT"] as const

interface Props {
  themes:      Theme[]
  watchedKeys: string[]
  items:       DiscoveryFeedItem[]
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${
        active
          ? "bg-[var(--np-accent)] text-white border-[var(--np-accent)]"
          : "bg-[var(--np-surface-elevated)] text-[var(--np-text-muted)] border-[var(--np-border)] hover:text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
      }`}
    >
      {children}
    </button>
  )
}

export function DiscoveryClient({ themes, watchedKeys, items }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTheme, setActiveTheme] = useState<string | null>(null)
  const [sinceDays, setSinceDays] = useState<number>(30)
  const [prefix, setPrefix] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [reqOpen, setReqOpen] = useState(false)
  const [reqLabel, setReqLabel] = useState("")
  const [reqDone, setReqDone] = useState(false)

  const subscribed = useMemo(
    () => themes.filter(t => watchedKeys.includes(t.key)),
    [themes, watchedKeys],
  )
  const available = useMemo(
    () => themes.filter(t => !watchedKeys.includes(t.key)),
    [themes, watchedKeys],
  )

  const filtered = useMemo(
    () =>
      items.filter(
        it =>
          (activeTheme === null || it.themes.some(t => t.key === activeTheme)) &&
          it.daysAgo <= sinceDays &&
          (prefix === null || (it.docketNumbers[0] ?? "").toUpperCase().startsWith(prefix)),
      ),
    [items, activeTheme, sinceDays, prefix],
  )

  const subscribe = (key: string) =>
    startTransition(async () => { await addWatchedTheme(key); setAdding(false); router.refresh() })
  const unsubscribe = (key: string) =>
    startTransition(async () => {
      await removeWatchedTheme(key)
      if (activeTheme === key) setActiveTheme(null)
      router.refresh()
    })
  const submitRequest = () =>
    startTransition(async () => {
      const r = await requestTheme(reqLabel)
      if (r.ok) { setReqDone(true); setReqLabel(""); setReqOpen(false) }
    })

  const Header = (
    <div className="mb-6">
      <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">Discovery</h1>
      <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
        Matters you don&rsquo;t track yet — surfaced because they match your themes.{" "}
        <span className="text-[var(--np-text-body)]">Covers FERC</span> (more markets coming).
      </p>
    </div>
  )

  // ── Empty state: no subscribed themes → onboard with the curated taxonomy ──
  if (subscribed.length === 0) {
    return (
      <div className="px-6 py-8 max-w-[900px] mx-auto">
        {Header}
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-6 py-8">
          <h2 className="text-[15px] font-semibold text-[var(--np-text-primary)] mb-1">Add your first theme</h2>
          <p className="text-[13px] text-[var(--np-text-muted)] mb-4">
            Pick the subjects you care about. We&rsquo;ll surface new FERC matters that match — even in
            dockets you don&rsquo;t track yet.
          </p>
          <div className="flex flex-wrap gap-2">
            {themes.map(t => (
              <button
                key={t.key}
                type="button"
                disabled={isPending}
                onClick={() => subscribe(t.key)}
                title={t.definition}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border border-[var(--np-border)] bg-[var(--np-surface)] text-[var(--np-text-body)] hover:border-[var(--np-accent)] hover:text-[var(--np-accent-text)] transition-colors cursor-pointer disabled:opacity-40"
              >
                <Plus size={13} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-[900px] mx-auto">
      {Header}

      {/* Your themes — subscribed chips (click filters · × removes) + add + request */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-[0.06em]">Your themes</span>
          {available.length > 0 && (
            <button
              type="button"
              onClick={() => setAdding(v => !v)}
              className="inline-flex items-center gap-1 text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors cursor-pointer"
            >
              <Plus size={13} /> Add theme
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip active={activeTheme === null} onClick={() => setActiveTheme(null)}>All</Chip>
          {subscribed.map(t => (
            <span key={t.key} className="inline-flex items-center">
              <Chip active={activeTheme === t.key} onClick={() => setActiveTheme(t.key)}>{t.label}</Chip>
              <button
                type="button"
                onClick={() => unsubscribe(t.key)}
                title={`Remove ${t.label}`}
                className="ml-0.5 text-[var(--np-text-muted)] hover:text-[var(--np-danger)] transition-colors cursor-pointer"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>

        {/* Add-theme picker */}
        {adding && available.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] p-3">
            {available.map(t => (
              <button
                key={t.key}
                type="button"
                disabled={isPending}
                onClick={() => subscribe(t.key)}
                title={t.definition}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] border border-[var(--np-border)] text-[var(--np-text-body)] hover:border-[var(--np-accent)] hover:text-[var(--np-accent-text)] transition-colors cursor-pointer disabled:opacity-40"
              >
                <Plus size={12} /> {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Request a theme — captures demand; curated manually (no per-user classify) */}
        <div className="mt-2">
          {reqDone ? (
            <p className="text-[12px] text-[var(--np-success)]">Thanks — we&rsquo;ll review your theme request.</p>
          ) : reqOpen ? (
            <div className="flex items-center gap-2">
              <input
                value={reqLabel}
                onChange={e => setReqLabel(e.target.value)}
                placeholder="e.g. Interconnection queue reform"
                className="flex-1 max-w-xs px-2.5 py-1 rounded-[var(--np-radius-sm)] border border-[var(--np-border)] bg-[var(--np-surface)] text-[12px] text-[var(--np-text-body)] outline-none focus:border-[var(--np-accent)]"
              />
              <button
                type="button"
                disabled={isPending || !reqLabel.trim()}
                onClick={submitRequest}
                className="h-7 px-3 rounded-[var(--np-radius-sm)] bg-[var(--np-accent)] text-white text-[12px] font-medium cursor-pointer disabled:opacity-40"
              >
                Request
              </button>
              <button type="button" onClick={() => setReqOpen(false)} className="text-[12px] text-[var(--np-text-muted)] cursor-pointer">Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReqOpen(true)}
              className="text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-accent-text)] transition-colors cursor-pointer"
            >
              Don&rsquo;t see your theme? Request one →
            </button>
          )}
        </div>
      </div>

      {/* Secondary filters: recency + optional docket prefix */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {RECENCY.map(r => (
          <Chip key={r.key} active={sinceDays === r.key} onClick={() => setSinceDays(r.key)}>{r.label}</Chip>
        ))}
        <span className="mx-1 text-[var(--np-border-strong)]">·</span>
        <Chip active={prefix === null} onClick={() => setPrefix(null)}>All dockets</Chip>
        {PREFIXES.map(p => (
          <Chip key={p} active={prefix === p} onClick={() => setPrefix(p)}>{p}</Chip>
        ))}
      </div>

      {/* Feed */}
      <p className="text-[12px] text-[var(--np-text-muted)] mb-3">{filtered.length} new {filtered.length === 1 ? "matter" : "matters"}</p>
      {filtered.length === 0 ? (
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-6 py-10 text-center text-[13px] text-[var(--np-text-muted)]">
          Nothing new this period for your themes.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(it => <DiscoveryFeedCard key={it.accession} item={it} />)}
        </div>
      )}
    </div>
  )
}
