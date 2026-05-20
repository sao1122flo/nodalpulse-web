"use client"

import { useState } from "react"
import { createApiKey, revokeApiKey, type ApiKeyRecord } from "./actions"

export function ApiKeysPanel({ keys }: { keys: ApiKeyRecord[] }) {
  const [label, setLabel] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [localKeys, setLocalKeys] = useState<ApiKeyRecord[]>(keys)
  const [copied, setCopied] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    setStatus("loading")
    setError("")
    setNewKey(null)

    const result = await createApiKey(label.trim())
    if (result.ok && result.key) {
      setNewKey(result.key)
      setLabel("")
      setLocalKeys(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          label: label.trim(),
          keyPrefix: result.key!.split("_")[1],
          createdAt: new Date(),
          lastUsedAt: null,
        },
      ])
      setStatus("idle")
    } else {
      setError(result.error ?? "Failed to create key.")
      setStatus("error")
    }
  }

  async function handleRevoke(keyId: string) {
    const result = await revokeApiKey(keyId)
    if (result.ok) {
      setLocalKeys(prev => prev.filter(k => k.id !== keyId))
    } else {
      setError(result.error ?? "Failed to revoke key.")
    }
  }

  async function handleCopy() {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* One-time key reveal */}
      {newKey && (
        <div className="rounded-[var(--np-radius-md)] border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)] p-4">
          <p className="text-[var(--np-success)] text-[12px] font-medium mb-2">
            API key created — copy it now. It won&rsquo;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] font-mono text-[var(--np-text-primary)] bg-[var(--np-surface-deep)] px-3 py-2 rounded-[var(--np-radius-sm)] border border-[var(--np-border)] overflow-x-auto">
              {newKey}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="h-8 px-3 rounded-[var(--np-radius-sm)] border border-[var(--np-border)] text-[var(--np-text-muted)] text-[12px] hover:text-[var(--np-text-body)] transition-colors cursor-pointer whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Existing keys */}
      {localKeys.length > 0 && (
        <div className="border border-[var(--np-border)] rounded-[var(--np-radius-md)] overflow-hidden">
          {localKeys.map((k, i) => (
            <div
              key={k.id}
              className={`flex items-center justify-between px-4 py-3 text-[13px] ${i < localKeys.length - 1 ? "border-b border-[var(--np-border)]" : ""}`}
            >
              <div>
                <span className="text-[var(--np-text-body)]">{k.label}</span>
                <span className="ml-2 text-[11px] font-mono text-[var(--np-text-muted)]">
                  np_{k.keyPrefix}_••••••••
                </span>
                {k.lastUsedAt && (
                  <p className="text-[11px] text-[var(--np-text-muted)] mt-0.5">
                    Last used {k.lastUsedAt.toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(k.id)}
                className="text-[var(--np-text-muted)] text-[12px] hover:text-[var(--np-danger)] transition-colors cursor-pointer"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          required
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Key label (e.g. prod-integration)"
          maxLength={64}
          disabled={status === "loading"}
          className="
            flex-1 h-9 px-3
            rounded-[var(--np-radius-md)]
            border border-[var(--np-border)]
            bg-[var(--np-surface-deep)]
            text-[var(--np-text-primary)] text-[13px]
            placeholder:text-[var(--np-text-muted)]
            outline-none focus:border-[var(--np-accent)]
            disabled:opacity-50
          "
        />
        <button
          type="submit"
          disabled={!label.trim() || status === "loading"}
          className="
            h-9 px-4 rounded-[var(--np-radius-md)]
            bg-[var(--np-accent)] text-[var(--np-accent-fg)]
            text-[13px] font-medium
            hover:bg-[var(--np-accent-hover)] transition-colors
            disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed
          "
        >
          {status === "loading" ? "Creating…" : "Create key"}
        </button>
      </form>

      {error && <p className="text-[12px] text-[var(--np-danger)]">{error}</p>}
    </div>
  )
}
