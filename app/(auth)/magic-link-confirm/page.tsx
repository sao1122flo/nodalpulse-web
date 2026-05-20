import type { Metadata } from "next"

export const metadata: Metadata = { title: "Sign in — NodalPulse" }

export default async function MagicLinkConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; callbackURL?: string }>
}) {
  const { token, callbackURL } = await searchParams

  // Validate callbackURL: relative paths only, no protocol-relative URLs.
  const safeCallback =
    callbackURL && callbackURL.startsWith("/") && !callbackURL.includes("//")
      ? callbackURL
      : "/dashboard"

  const card = `
    w-full max-w-[400px] mx-auto
    rounded-[var(--np-radius-lg)] border border-[var(--np-border)]
    bg-[var(--np-surface-elevated)] p-8
  `

  if (!token) {
    return (
      <div className={card} style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center gap-2 mb-6">
          <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">&#9632;</span>
          <span className="font-bold text-[var(--np-text-primary)] text-base tracking-tight">NodalPulse</span>
        </div>
        <h1 className="text-[var(--np-text-primary)] font-semibold text-[18px] mb-2">
          Link expired or invalid
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mb-6">
          This sign-in link is missing or has already been used. Request a new one.
        </p>
        <a
          href="/login"
          className="
            inline-flex items-center justify-center w-full h-9
            rounded-[var(--np-radius-md)]
            bg-[var(--np-accent)] text-[var(--np-accent-fg)]
            text-[13px] font-medium
            hover:bg-[var(--np-accent-hover)] transition-colors
          "
        >
          Back to sign-in
        </a>
      </div>
    )
  }

  return (
    <div className={card} style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
      {/* Brand */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">&#9632;</span>
        <span className="font-bold text-[var(--np-text-primary)] text-base tracking-tight">NodalPulse</span>
      </div>

      <h1 className="text-[var(--np-text-primary)] font-semibold text-[18px] mb-2 tracking-tight">
        Complete your sign-in
      </h1>
      <p className="text-[var(--np-text-muted)] text-[13px] mb-6 leading-relaxed">
        Click the button below to sign in to NodalPulse. This confirms your identity
        and creates your session.
      </p>

      <form method="POST" action="/api/magic-link-confirm">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="callbackURL" value={safeCallback} />
        <button
          type="submit"
          className="
            w-full h-9
            rounded-[var(--np-radius-md)]
            bg-[var(--np-accent)] text-[var(--np-accent-fg)]
            text-[13px] font-medium
            hover:bg-[var(--np-accent-hover)] transition-colors
            cursor-pointer
          "
        >
          Sign in to NodalPulse
        </button>
      </form>

      <p className="mt-5 text-[var(--np-text-muted)] text-[12px]">
        Wrong account?{" "}
        <a
          href="/login"
          className="text-[var(--np-text-body)] underline underline-offset-2 hover:text-[var(--np-text-strong)] transition-colors"
        >
          Use a different email
        </a>
      </p>
    </div>
  )
}
