"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/admin", label: "Index" },
  { href: "/admin/crawls", label: "Crawls" },
  { href: "/admin/evals", label: "Evals" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/extractions", label: "Extractions" },
  { href: "/admin/cost", label: "Cost" },
  { href: "/admin/qa", label: "QA" },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-0.5">
      {LINKS.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={[
            "px-2.5 py-1 rounded text-[11px] font-mono transition-colors",
            pathname === link.href
              ? "text-[var(--np-text-primary)] bg-[var(--np-surface-deep)]"
              : "text-[var(--np-text-muted)] hover:text-[var(--np-text-body)]",
          ].join(" ")}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
