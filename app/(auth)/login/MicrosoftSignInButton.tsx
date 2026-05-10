"use client"

interface Props {
  onClick: () => void
  loading: boolean
  disabled: boolean
}

export function MicrosoftSignInButton({ onClick, loading, disabled }: Props) {
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
        <svg viewBox="0 0 21 21" width="20" height="20" aria-hidden="true" className="shrink-0">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
      )}
      <span className="flex-1 text-left">
        {loading ? "Connecting…" : "Continue with Microsoft"}
      </span>
    </button>
  )
}
