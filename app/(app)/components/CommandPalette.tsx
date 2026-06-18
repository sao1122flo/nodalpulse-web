"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"

interface TrackedDocket {
  externalId:   string
  title:        string | null
  jurisdiction: string | null
}

const JURISDICTION_BADGE: Record<string, string> = {
  PUCT:         "PUCT",
  ERCOT:        "ERCOT",
  "CAISO-FERC": "CAISO",
  CAISO:        "CAISO",
  CPUC:         "CPUC",
  "PJM-FERC":   "PJM",
  PJM:          "PJM",
  FERC:         "FERC",
}

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/dashboard",       hint: "Go to dashboard"         },
  { label: "Brief History",   href: "/briefs",          hint: "View all briefs"          },
  { label: "Dockets",         href: "/dockets",         hint: "Manage tracked dockets"   },
  { label: "Ask the Record",  href: "/chat",            hint: "Ask questions about filings" },
  { label: "Settings",        href: "/settings",        hint: "Account and preferences"  },
]

export function CommandPalette() {
  const [open,   setOpen]   = useState(false)
  const [dockets, setDockets] = useState<TrackedDocket[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query,  setQuery]  = useState("")
  const router = useRouter()

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Fetch tracked dockets on first open
  useEffect(() => {
    if (!open || loaded) return
    fetch("/api/dockets/search")
      .then(r => r.json())
      .then(d => { setDockets(d.dockets ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [open, loaded])

  function close() {
    setOpen(false)
    setQuery("")
  }

  function openDocket(externalId: string) {
    const u = new URL(window.location.href)
    u.searchParams.set("docket", externalId)
    router.push(u.pathname + "?" + u.searchParams.toString(), { scroll: false })
    close()
  }

  function navigate(href: string) {
    router.push(href)
    close()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[18vh] px-4"
      onMouseDown={e => { if (e.target === e.currentTarget) close() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={close} />

      {/* Dialog */}
      <div className="relative w-full max-w-[560px]">
        <Command
          className="rounded-[var(--np-radius-xl)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] shadow-2xl overflow-hidden"
          onKeyDown={e => { if (e.key === "Escape") close() }}
          shouldFilter
          loop
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--np-border)]">
            <span className="text-[var(--np-text-muted)] text-[14px] flex-shrink-0">⌘</span>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search dockets, navigate…"
              autoFocus
              className="flex-1 bg-transparent text-[13px] text-[var(--np-text-primary)] placeholder:text-[var(--np-text-muted)] outline-none"
            />
            <kbd className="text-[10px] text-[var(--np-text-muted)] border border-[var(--np-border)] px-1.5 py-0.5 rounded font-mono flex-shrink-0">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto py-2">
            <Command.Empty className="px-4 py-8 text-center text-[13px] text-[var(--np-text-muted)]">
              No results
            </Command.Empty>

            {/* Navigation */}
            <Command.Group
              heading="Navigate"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--np-text-muted)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
            >
              {NAV_ITEMS.map(item => (
                <Command.Item
                  key={item.href}
                  value={item.label}
                  onSelect={() => navigate(item.href)}
                  className="flex items-center gap-3 px-3 py-2 mx-1 rounded-[var(--np-radius-md)] text-[13px] cursor-pointer data-[selected=true]:bg-[var(--np-surface-deep)] transition-colors"
                >
                  <span className="text-[var(--np-text-primary)] font-medium">{item.label}</span>
                  <span className="text-[var(--np-text-muted)] text-[12px]">{item.hint}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Tracked dockets */}
            {dockets.length > 0 && (
              <Command.Group
                heading="Tracked Dockets"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--np-text-muted)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {dockets.map(d => {
                  const jLabel = d.jurisdiction
                    ? (JURISDICTION_BADGE[d.jurisdiction] ?? d.jurisdiction)
                    : null
                  return (
                    <Command.Item
                      key={d.externalId}
                      value={`${d.externalId} ${d.title ?? ""} ${jLabel ?? ""}`}
                      onSelect={() => openDocket(d.externalId)}
                      className="flex items-center gap-2.5 px-3 py-2 mx-1 rounded-[var(--np-radius-md)] cursor-pointer data-[selected=true]:bg-[var(--np-surface-deep)] transition-colors"
                    >
                      {jLabel && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)] font-medium">
                          {jLabel}
                        </span>
                      )}
                      <span className="font-mono text-[12px] text-[var(--np-text-primary)] flex-shrink-0">
                        {d.externalId}
                      </span>
                      {d.title && (
                        <span className="text-[12px] text-[var(--np-text-muted)] truncate min-w-0">
                          {d.title}
                        </span>
                      )}
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {!loaded && (
              <div className="px-3 py-2 text-[12px] text-[var(--np-text-muted)]">
                Loading dockets…
              </div>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
