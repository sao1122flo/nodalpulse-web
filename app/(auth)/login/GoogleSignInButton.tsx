"use client"

interface Props {
  onClick: () => void
  loading: boolean
  disabled: boolean
}

export function GoogleSignInButton({ onClick, loading, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="
        w-full h-10 px-3
        flex items-center gap-3
        rounded-[var(--np-radius-md)]
        border border-[var(--np-border)]
        bg-[var(--np-surface-deep)]
        text-[var(--np-text-primary)] text-[13px] font-medium
        transition-colors
        hover:bg-[var(--np-surface-elevated)] hover:border-[var(--np-border-strong)]
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer
      "
    >
      {loading ? (
        <span className="w-5 h-5 flex items-center justify-center shrink-0">
          <svg className="animate-spin" viewBox="0 0 20 20" width="16" height="16" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
            <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        /* Google "G" logo — official colors, dark variant */
        <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" className="shrink-0">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
      )}
      <span className="flex-1 text-left">
        {loading ? "Connecting…" : "Continue with Google"}
      </span>
    </button>
  )
}
