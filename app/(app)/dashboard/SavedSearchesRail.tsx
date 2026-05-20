"use client"

import { useState, useTransition } from "react"
import {
  deleteSavedSearch,
  fireSavedSearch,
  updateSavedSearch,
} from "@/app/(app)/saved-searches/actions"
import type { SavedSearchRow } from "@/app/(app)/saved-searches/actions"
import type { SavedSearchFiling } from "@/lib/services-client"

// ---------------------------------------------------------------------------
// Predicate summary chips — show what the search is filtering on
// ---------------------------------------------------------------------------

function PredicateChips({ query }: { query: SavedSearchRow["query"] }) {
  const chips: string[] = []
  if (query.markets?.length) chips.push(...query.markets.map(m => `market: ${m}`))
  if (query.text) chips.push(`text: "${query.text}"`)
  if (query.docket_ids?.length) chips.push(`dockets: ${query.docket_ids.length}`)
  if (query.tdu_zones?.length) chips.push(...query.tdu_zones.map(z => `zone: ${z}`))
  if (!chips.length) chips.push("all filings")
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {chips.map(chip => (
        <span
          key={chip}
          className="
            inline-flex items-center px-1.5 py-0.5
            rounded text-[10px] font-medium
            bg-[var(--np-surface-deep)] text-[var(--np-text-muted)]
            border border-[var(--np-border)]
          "
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single search card
// ---------------------------------------------------------------------------

function SearchCard({
  search,
  onDelete,
  onNotifyToggle,
}: {
  search: SavedSearchRow
  onDelete: (id: string) => void
  onNotifyToggle: (id: string, notify: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<SavedSearchFiling[] | null>(null)
  const [fireError, setFireError] = useState("")
  const [showResults, setShowResults] = useState(false)

  function handleFire() {
    setFireError("")
    startTransition(async () => {
      const res = await fireSavedSearch(search.id)
      if (!res.ok) {
        setFireError(res.error)
        return
      }
      setResults(res.value.filings)
      setShowResults(true)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSavedSearch(search.id)
      onDelete(search.id)
    })
  }

  function handleNotifyToggle() {
    const next = !search.notify
    startTransition(async () => {
      await updateSavedSearch(search.id, { notify: next })
      onNotifyToggle(search.id, next)
    })
  }

  const lastFiredLabel = search.lastFiredAt
    ? `Last run ${new Date(search.lastFiredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "Never run"

  return (
    <div className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[var(--np-text-body)] truncate">{search.name}</p>
          <PredicateChips query={search.query} />
        </div>
        <button
          onClick={handleNotifyToggle}
          disabled={isPending}
          title={search.notify ? "Notifications on — click to disable" : "Notifications off — click to enable"}
          className={`
            flex-shrink-0 w-8 h-5 mt-0.5 rounded-full transition-colors cursor-pointer
            relative border
            ${search.notify
              ? "bg-[var(--np-accent)] border-[var(--np-accent)]"
              : "bg-[var(--np-surface-deep)] border-[var(--np-border-strong)]"
            }
            disabled:opacity-40
          `}
        >
          <span className={`
            absolute left-0 top-px w-4 h-4 rounded-full bg-white shadow-sm transition-transform
            ${search.notify ? "translate-x-3" : "translate-x-0.5"}
          `} />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--np-border)]">
        <span className="text-[10px] text-[var(--np-text-muted)]">{lastFiredLabel}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFire}
            disabled={isPending}
            className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors cursor-pointer disabled:opacity-40"
          >
            {isPending ? "Running…" : "Run"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-[11px] text-[var(--np-text-muted)] hover:text-[var(--np-danger)] transition-colors cursor-pointer disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {fireError && (
        <p className="text-[11px] text-[var(--np-danger)] mt-1">{fireError}</p>
      )}

      {showResults && results !== null && (
        <div className="mt-2 pt-2 border-t border-[var(--np-border)]">
          {results.length === 0 ? (
            <p className="text-[11px] text-[var(--np-text-muted)]">No matches in the last 7 days.</p>
          ) : (
            <>
              <p className="text-[11px] text-[var(--np-text-muted)] mb-1.5">
                {results.length} filing{results.length !== 1 ? "s" : ""} matched
              </p>
              <ul className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                {results.map(f => (
                  <li key={f.id}>
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[var(--np-accent-text)] hover:underline line-clamp-2"
                      >
                        {f.title}
                      </a>
                    ) : (
                      <span className="text-[11px] text-[var(--np-text-body)] line-clamp-2">{f.title}</span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowResults(false)}
                className="mt-1 text-[10px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors cursor-pointer"
              >
                Hide results
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main rail component
// ---------------------------------------------------------------------------

interface Props {
  savedSearches: SavedSearchRow[]
  isPaidUser: boolean
}

export function SavedSearchesRail({ savedSearches: initialSearches, isPaidUser }: Props) {
  const [searches, setSearches] = useState(initialSearches)

  function handleDelete(id: string) {
    setSearches(prev => prev.filter(s => s.id !== id))
  }

  function handleNotifyToggle(id: string, notify: boolean) {
    setSearches(prev => prev.map(s => s.id === id ? { ...s, notify } : s))
  }

  return (
    <aside className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[var(--np-text-strong)] tracking-wide uppercase">
          Saved searches
        </h2>
        <a
          href="/settings"
          className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
        >
          Manage →
        </a>
      </div>

      {!isPaidUser ? (
        <div className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-3 py-3 text-center">
          <p className="text-[12px] text-[var(--np-text-muted)] mb-2">
            Saved searches are available on paid plans.
          </p>
          <a
            href="/pricing?return=%2Fdashboard"
            className="inline-flex items-center h-7 px-3 rounded-[var(--np-radius-md)] border border-[var(--np-accent)] text-[var(--np-accent-text)] text-[12px] font-medium hover:bg-[var(--np-accent)] hover:text-white transition-colors"
          >
            View plans →
          </a>
        </div>
      ) : searches.length === 0 ? (
        <div className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-3 py-3 text-center">
          <p className="text-[12px] text-[var(--np-text-muted)] mb-2">
            No saved searches yet.
          </p>
          <a
            href="/settings"
            className="text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Create saved searches in Settings →
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {searches.map(s => (
            <SearchCard
              key={s.id}
              search={s}
              onDelete={handleDelete}
              onNotifyToggle={handleNotifyToggle}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
