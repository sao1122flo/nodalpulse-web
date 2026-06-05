import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { LayoutDashboard, Archive, BookOpen, MessageSquare, Settings } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userProfiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { SignOutButton } from "./sign-out-button"
import { MobileNav } from "./MobileNav"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/briefs", label: "Brief History", icon: Archive },
  { href: "/dockets", label: "Dockets", icon: BookOpen },
  { href: "/chat", label: "Q&A", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session = null
  try {
    session = await auth.api.getSession({ headers: await headers() })
  } catch {
    // malformed/expired session cookie — treat as logged out
  }

  if (!session) {
    redirect("/login")
  }

  // Check if user has completed onboarding
  const [profile] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .limit(1)

  if (!profile) {
    redirect("/onboarding")
  }

  return (
    <div className="flex h-screen bg-[var(--np-surface)] overflow-hidden">
      {/* Sidebar */}
      <aside
        className="hidden md:flex w-[220px] flex-shrink-0 flex-col border-r border-[var(--np-border)] bg-[var(--np-surface-elevated)]"
        style={{ height: "100vh", position: "fixed", top: 0, left: 0 }}
      >
        {/* Logotype */}
        <div className="px-4 py-4 border-b border-[var(--np-border)]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">
              &#9632;
            </span>
            <span className="font-bold text-[var(--np-text-primary)] text-[14px] tracking-tight">
              NodalPulse
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="
                flex items-center gap-2.5 px-2.5 py-2 mb-0.5
                rounded-[var(--np-radius-md)]
                text-[var(--np-text-body)] text-[13px]
                hover:bg-[var(--np-surface-deep)] hover:text-[var(--np-text-strong)]
                transition-colors
                group
              "
            >
              <Icon
                size={15}
                className="text-[var(--np-text-muted)] group-hover:text-[var(--np-text-strong)] flex-shrink-0 transition-colors"
              />
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom: user info + sign out */}
        <div className="px-3 py-3 border-t border-[var(--np-border)]">
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-[var(--np-text-muted)] text-[11px] truncate"
              title={session.user.email}
            >
              {session.user.email}
            </p>
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Main content — offset for fixed sidebar on desktop */}
      <main className="flex-1 overflow-y-auto md:ml-[220px]">
        <MobileNav userEmail={session.user.email} />
        {children}
        <footer className="border-t border-[var(--np-border)] px-6 py-4 mt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[var(--np-text-muted)]">
            <a href="/terms" className="hover:text-[var(--np-text-body)] transition-colors">
              Terms
            </a>
            <span aria-hidden="true">·</span>
            <a href="/privacy" className="hover:text-[var(--np-text-body)] transition-colors">
              Privacy
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://status.nodalpulse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--np-text-body)] transition-colors"
            >
              Status
            </a>
            <span aria-hidden="true">·</span>
            <span>© 2026 Cordillera Ventures LLC</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
