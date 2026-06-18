"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { EntityRecord } from "./actions"
import { addEntity, updateEntityAliases, deleteEntity } from "./actions"

export function EntitiesSettings({
  initialEntities,
}: {
  initialEntities: EntityRecord[]
}) {
  const router = useRouter()
  const [entities, setEntities] = useState(initialEntities)
  const [isPending, startTransition] = useTransition()
  const [newName, setNewName] = useState("")
  const [newAliases, setNewAliases] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAliases, setEditAliases] = useState("")

  function refresh() {
    router.refresh()
  }

  function handleAdd() {
    const name = newName.trim()
    if (!name || isPending) return
    const aliases = newAliases
      .split(",")
      .map(a => a.trim())
      .filter(Boolean)
    setAddError(null)
    startTransition(async () => {
      const result = await addEntity(name, aliases)
      if (!result.ok) {
        setAddError(result.error ?? "Error saving entity.")
        return
      }
      setNewName("")
      setNewAliases("")
      refresh()
    })
  }

  function handleDelete(id: string) {
    if (isPending) return
    startTransition(async () => {
      const result = await deleteEntity(id)
      if (result.ok) {
        setEntities(prev => prev.filter(e => e.id !== id))
      }
    })
  }

  function startEdit(entity: EntityRecord) {
    setEditingId(entity.id)
    setEditAliases(entity.aliases.join(", "))
  }

  function handleEditSave(id: string) {
    if (isPending) return
    const aliases = editAliases
      .split(",")
      .map(a => a.trim())
      .filter(Boolean)
    startTransition(async () => {
      const result = await updateEntityAliases(id, aliases)
      if (result.ok) {
        setEntities(prev =>
          prev.map(e => (e.id === id ? { ...e, aliases } : e))
        )
        setEditingId(null)
      }
    })
  }

  return (
    <div>
      {/* Shared-responsibility disclaimer */}
      <div className="rounded-[var(--np-radius-md)] bg-[var(--np-surface-deep)] border border-[var(--np-border)] px-4 py-3 mb-5 text-[12px] text-[var(--np-text-body)] leading-relaxed">
        <p>
          Discovery watches the names you add. Filings are often made under a project or
          subsidiary name — not your parent company. To catch everything, add every name
          that&rsquo;s yours: your company, its subsidiaries and affiliates, your project
          LLCs/SPVs, and common variations. The more complete your list, the more we catch.
        </p>
      </div>

      {/* Entity list */}
      {entities.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {entities.map(entity => (
            <div
              key={entity.id}
              className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-3"
            >
              {editingId === entity.id ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] font-medium text-[var(--np-text-primary)]">
                    {entity.name}
                  </p>
                  <div>
                    <label className="text-[11px] text-[var(--np-text-muted)] block mb-1">
                      Subsidiaries &amp; aliases (comma-separated) ·{" "}
                      <span className="italic">include subsidiaries and project names — filings rarely use just the parent&rsquo;s name</span>
                    </label>
                    <input
                      type="text"
                      value={editAliases}
                      onChange={e => setEditAliases(e.target.value)}
                      placeholder="e.g. Hecate Energy LLC, Hecate Energy Highland LLC"
                      className="
                        w-full h-8 px-3 rounded-[var(--np-radius-sm)]
                        border border-[var(--np-border)] bg-[var(--np-surface)]
                        text-[12px] text-[var(--np-text-primary)]
                        focus:outline-none focus:border-[var(--np-accent)]
                      "
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSave(entity.id)}
                      disabled={isPending}
                      className="
                        h-7 px-3 rounded-[var(--np-radius-sm)]
                        bg-[var(--np-accent)] text-[var(--np-accent-fg)]
                        text-[12px] font-medium
                        hover:bg-[var(--np-accent-hover)] transition-colors
                        disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed
                      "
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="
                        h-7 px-3 rounded-[var(--np-radius-sm)]
                        border border-[var(--np-border)]
                        text-[12px] text-[var(--np-text-muted)]
                        hover:text-[var(--np-text-body)] transition-colors
                        cursor-pointer
                      "
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--np-text-primary)]">
                      {entity.name}
                    </p>
                    {entity.aliases.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entity.aliases.map(alias => (
                          <span
                            key={alias}
                            className="
                              inline-flex items-center px-2 py-0.5
                              rounded-full text-[11px]
                              bg-[var(--np-surface-deep)] text-[var(--np-text-muted)]
                              border border-[var(--np-border)]
                            "
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(entity)}
                      className="text-[12px] text-[var(--np-text-muted)] hover:text-[var(--np-accent-text)] transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entity.id)}
                      disabled={isPending}
                      className="text-[12px] text-[var(--np-danger)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="border-t border-[var(--np-border)] pt-4">
        <p className="text-[12px] font-medium text-[var(--np-text-body)] mb-2">Add entity</p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Company or entity name — e.g. Hecate Energy"
            className="
              h-9 px-3 rounded-[var(--np-radius-sm)]
              border border-[var(--np-border)] bg-[var(--np-surface)]
              text-[13px] text-[var(--np-text-primary)]
              focus:outline-none focus:border-[var(--np-accent)]
            "
            onKeyDown={e => { if (e.key === "Enter") handleAdd() }}
          />
          <div className="relative">
            <input
              type="text"
              value={newAliases}
              onChange={e => setNewAliases(e.target.value)}
              placeholder="Subsidiaries &amp; aliases (comma-separated, optional)"
              title="Include subsidiaries and project names — filings rarely use just the parent's name."
              className="
                w-full h-9 px-3 rounded-[var(--np-radius-sm)]
                border border-[var(--np-border)] bg-[var(--np-surface)]
                text-[12px] text-[var(--np-text-primary)]
                focus:outline-none focus:border-[var(--np-accent)]
              "
            />
          </div>
          <p className="text-[11px] text-[var(--np-text-muted)]">
            Include subsidiaries and project names — filings rarely use just the parent&rsquo;s name.
          </p>
          {addError && (
            <p className="text-[12px] text-[var(--np-danger)]">{addError}</p>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || !newName.trim()}
            className="
              self-start h-9 px-4
              rounded-[var(--np-radius-md)]
              bg-[var(--np-accent)] text-[var(--np-accent-fg)]
              text-[13px] font-medium
              hover:bg-[var(--np-accent-hover)] transition-colors
              disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed
            "
          >
            {isPending ? "Saving…" : "Add entity"}
          </button>
        </div>
      </div>
    </div>
  )
}
