export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--np-bg)]">
      <div className="border-b border-[var(--np-border)] px-8 py-3 flex items-center gap-2">
        <span className="text-[var(--np-text-muted)] text-[11px] font-mono uppercase tracking-widest">
          NodalPulse
        </span>
        <span className="text-[var(--np-text-muted)] text-[11px] font-mono">/</span>
        <span className="text-[var(--np-text-body)] text-[11px] font-mono">__admin</span>
      </div>
      <main className="px-8 py-8">{children}</main>
    </div>
  )
}
