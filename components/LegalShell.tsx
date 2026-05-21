import Link from "next/link"

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--np-surface)]">
      <header className="border-b border-[var(--np-border)] bg-[var(--np-surface-elevated)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 no-underline"
            aria-label="NodalPulse home"
          >
            <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">&#9632;</span>
            <span className="font-bold text-[var(--np-text-primary)] text-[14px] tracking-tight">
              NodalPulse
            </span>
          </Link>
          <Link
            href="/login"
            className="text-[13px] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors"
          >
            Sign in &rarr;
          </Link>
        </div>
      </header>

      <main className="legal-prose max-w-3xl mx-auto px-6 py-16">
        {children}
      </main>

      <footer className="border-t border-[var(--np-border)] py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--np-text-muted)]">
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[var(--np-text-body)] transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-[var(--np-text-body)] transition-colors">
              Privacy Policy
            </Link>
          </div>
          <span>© 2026 Cordillera Ventures LLC</span>
        </div>
      </footer>
    </div>
  )
}
