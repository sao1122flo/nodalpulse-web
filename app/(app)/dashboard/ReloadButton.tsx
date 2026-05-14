"use client"

export function ReloadButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="
        mt-2
        text-[var(--np-accent-text)] text-[12px]
        hover:text-[var(--np-accent-hover)] transition-colors
        cursor-pointer
      "
    >
      Try reloading
    </button>
  )
}
