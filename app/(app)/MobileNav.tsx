"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { LayoutDashboard, Archive, BookOpen, MessageSquare, Settings, Menu, X } from "lucide-react"
import { SignOutButton } from "./sign-out-button"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/briefs", label: "Brief History", icon: Archive },
  { href: "/dockets", label: "Dockets", icon: BookOpen },
  { href: "/chat", label: "Ask the Record", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function MobileNav({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  // Focus trap + initial focus
  useEffect(() => {
    if (!open || !drawerRef.current) return
    const el = drawerRef.current
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener("keydown", trap)
    return () => document.removeEventListener("keydown", trap)
  }, [open])

  return (
    <>
      {/* Sticky top bar — mobile only */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-12 border-b border-[var(--np-border)] bg-[var(--np-surface-elevated)]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">&#9632;</span>
          <span className="font-bold text-[var(--np-text-primary)] text-[14px] tracking-tight">
            NodalPulse
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="
            flex items-center justify-center w-9 h-9
            rounded-[var(--np-radius-md)]
            text-[var(--np-text-muted)]
            hover:text-[var(--np-text-strong)] hover:bg-[var(--np-surface-deep)]
            transition-colors
          "
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`
          fixed inset-0 z-50 bg-black/50
          transition-opacity duration-200
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`
          fixed inset-y-0 left-0 z-50
          w-[260px] flex flex-col
          bg-[var(--np-surface-elevated)] border-r border-[var(--np-border)]
          transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Drawer header */}
        <div className="px-4 py-3 border-b border-[var(--np-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">&#9632;</span>
            <span className="font-bold text-[var(--np-text-primary)] text-[14px] tracking-tight">
              NodalPulse
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="
              flex items-center justify-center w-9 h-9
              rounded-[var(--np-radius-md)]
              text-[var(--np-text-muted)]
              hover:text-[var(--np-text-strong)] hover:bg-[var(--np-surface-deep)]
              transition-colors
            "
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="
                flex items-center gap-2.5 px-3 py-3 mb-0.5
                rounded-[var(--np-radius-md)]
                text-[var(--np-text-body)] text-[13px]
                hover:bg-[var(--np-surface-deep)] hover:text-[var(--np-text-strong)]
                transition-colors
              "
            >
              <Icon size={15} className="text-[var(--np-text-muted)] flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom: user + sign out */}
        <div className="px-3 py-3 border-t border-[var(--np-border)]">
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-[var(--np-text-muted)] text-[11px] truncate"
              title={userEmail}
            >
              {userEmail}
            </p>
            <SignOutButton />
          </div>
        </div>
      </div>
    </>
  )
}
