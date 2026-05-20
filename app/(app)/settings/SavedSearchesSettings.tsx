"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import {
  createSavedSearch,
  deleteSavedSearch,
  updateSavedSearch,
} from "@/app/(app)/saved-searches/actions"
import type { SavedSearchRow } from "@/app/(app)/saved-searches/actions"
import type { SavedSearchQuery } from "@/db/schema"

// ---------------------------------------------------------------------------
// Predicate summary — compact label showing what the search filters on
// ---------------------------------------------------------------------------

function predicateSummary(query: SavedSearchQuery): string {
  const parts: string[] = []
  if (query.markets?.length) parts.push(`markets: ${query.markets.join(", ")}`)
  if (query.text) parts.push(`"${query.text}"`)
  if (query.docket_ids?.length) parts.push(`${query.docket_ids.length} docket(s)`)
  if (query.tdu_zones?.length) parts.push(`zones: ${query.tdu_zones.join(", ")}`)
  return parts.length ? parts.join(" · ") : "All filings"
}

// ---------------------------------------------------------------------------
// Inline rename input
// ---------------------------------------------------------------------------

function InlineRename({
  current,
  onSave,
  onCancel,
}: {
  current: string
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(current)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); onSave(value) }
    if (e.key === "Escape") onCancel()
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => onSave(value)}
      onKeyDown={handleKey}
      className="
        h-7 px-2 flex-1
        rounded-[var(--np-radius-sm)]
        border border-[var(--np-border-strong)]
        bg-[var(--np-surface-elevated)]
        text-[var(--np-text-body)] text-[13px]
        focus:outline-none focus:border-[var(--np-accent)]
      "
    />
  )
}

// ---------------------------------------------------------------------------
// Add search form
// ---------------------------------------------------------------------------

function AddSearchForm({
  limit,
  count,
  onAdded,
}: {
  limit: number | null
  count: number
  onAdded: (row: SavedSearchRow) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const atLimit = limit !== null && count >= limit

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={atLimit}
        title={atLimit ? `Limit of ${limit} reached` : undefined}
        className="
          h-8 px-3 rounded-[var(--np-radius-md)]
          border border-dashed border-[var(--np-border-strong)]
          text-[var(--np-text-muted)] text-[12px]
          hover:border-[var(--np-accent)] hover:text-[var(--np-accent-text)]
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors cursor-pointer
        "
      >
        + Add saved search
      </button>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const query: SavedSearchQuery = text.trim() ? { text: text.trim() } : {}
      const result = await createSavedSearch(name, query)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onAdded({
        id: result.value.id,
        name: name.trim(),
        query,
        notify: true,
        lastFiredAt: null,
        createdAt: new Date(),
      })
      setName("")
      setText("")
      setOpen(false)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 py-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Search name (e.g. BESS interconnection)"
        disabled={isPending}
        autoFocus
        className="
          h-8 px-2.5
          rounded-[var(--np-radius-md)]
          border border-[var(--np-border)]
          bg-[var(--np-surface-elevated)]
          text-[var(--np-text-body)] text-[13px]
          placeholder:text-[var(--np-text-muted)]
          focus:outline-none focus:border-[var(--np-border-strong)]
          disabled:opacity-40
        "
      />
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Keywords (optional)"
        disabled={isPending}
        className="
          h-8 px-2.5
          rounded-[var(--np-radius-md)]
          border border-[var(--np-border)]
          bg-[var(--np-surface-elevated)]
          text-[var(--np-text-body)] text-[13px]
          placeholder:text-[var(--np-text-muted)]
          focus:outline-none focus:border-[var(--np-border-strong)]
          disabled:opacity-40
        "
      />
      {error && <p className="text-[11px] text-[var(--np-danger)]">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="
            h-7 px-3 rounded-[var(--np-radius-md)]
            bg-[var(--np-accent)] text-[var(--np-accent-fg)] text-[12px] font-medium
            hover:bg-[var(--np-accent-hover)]
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors cursor-pointer
          "
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError("") }}
          className="h-7 px-3 rounded-[var(--np-radius-md)] border border-[var(--np-border)] text-[var(--np-text-muted)] text-[12px] hover:text-[var(--np-text-body)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  initialSearches: SavedSearchRow[]
  limit: number | null
}

export function SavedSearchesSettings({ initialSearches, limit }: Props) {
  const [searches, setSearches] = useState(initialSearches)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdded(row: SavedSearchRow) {
    setSearches(prev => [...prev, row])
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteSavedSearch(id)
      setSearches(prev => prev.filter(s => s.id !== id))
    })
  }

  function handleRename(id: string, name: string) {
    setRenamingId(null)
    if (!name.trim()) return
    startTransition(async () => {
      await updateSavedSearch(id, { name })
      setSearches(prev => prev.map(s => s.id === id ? { ...s, name: name.trim() } : s))
    })
  }

  function handleNotifyToggle(id: string) {
    const search = searches.find(s => s.id === id)
    if (!search) return
    const next = !search.notify
    startTransition(async () => {
      await updateSavedSearch(id, { notify: next })
      setSearches(prev => prev.map(s => s.id === id ? { ...s, notify: next } : s))
    })
  }

  const limitLabel = limit === null ? "∞" : String(limit)

  return (
    <div className="flex flex-col gap-2">
      {searches.length > 0 && (
        <ul className="flex flex-col">
          {searches.map(s => (
            <li
              key={s.id}
              className="flex items-center gap-2 py-2.5 border-b border-[var(--np-border)] last:border-0"
            >
              {/* Notify toggle */}
              <button
                onClick={() => handleNotifyToggle(s.id)}
                disabled={isPending}
                title={s.notify ? "Notifications on — click to disable" : "Notifications off — click to enable"}
                className={`
                  flex-shrink-0 w-8 h-5 rounded-full transition-colors cursor-pointer
                  relative border
                  ${s.notify
                    ? "bg-[var(--np-accent)] border-[var(--np-accent)]"
                    : "bg-[var(--np-surface-deep)] border-[var(--np-border-strong)]"
                  }
                  disabled:opacity-40
                `}
              >
                <span className={`
                  absolute left-0 top-px w-4 h-4 rounded-full bg-white shadow-sm transition-transform
                  ${s.notify ? "translate-x-3" : "translate-x-0.5"}
                `} />
              </button>

              {/* Name / inline rename */}
              <div className="flex-1 min-w-0">
                {renamingId === s.id ? (
                  <InlineRename
                    current={s.name}
                    onSave={name => handleRename(s.id, name)}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <div>
                    <p className="text-[13px] text-[var(--np-text-body)] truncate">{s.name}</p>
                    <p className="text-[11px] text-[var(--np-text-muted)] truncate mt-0.5">
                      {predicateSummary(s.query)}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {renamingId !== s.id && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => setRenamingId(s.id)}
                    disabled={isPending}
                    className="text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={isPending}
                    className="text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-danger)] transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between pt-1">
        <AddSearchForm
          limit={limit}
          count={searches.length}
          onAdded={handleAdded}
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--np-text-muted)]">
            {searches.length} of {limitLabel} used
          </span>
          {limit !== null && searches.length >= limit && (
            <a
              href="/pricing"
              className="text-[11px] text-[var(--np-accent-text)] hover:underline"
            >
              Upgrade →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
