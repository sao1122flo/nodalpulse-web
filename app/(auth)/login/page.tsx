"use client"

import { useState } from "react"
import type { Metadata } from "next"
import { authClient } from "@/lib/auth-client"

// Note: metadata export doesn't work in client components — title is set via
// the root layout's template. A separate server wrapper can wrap this if needed.

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    setStatus("loading")
    setErrorMsg("")

    const result = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
    })

    if (result.error) {
      setErrorMsg(result.error.message ?? "Something went wrong. Please try again.")
      setStatus("error")
    } else {
      setStatus("sent")
    }
  }

  return (
    <div
      className="w-full max-w-[400px] mx-auto rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] p-8"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
    >
      {/* Logotype */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[var(--np-accent)] text-[10px] leading-none"
            aria-hidden="true"
          >
            &#9632;
          </span>
          <span className="font-bold text-[var(--np-text-primary)] text-base tracking-tight">
            NodalPulse
          </span>
        </div>
        <p className="text-[var(--np-text-muted)] text-[13px] leading-snug">
          Regulatory intelligence for ERCOT participants.
        </p>
      </div>

      {status === "sent" ? (
        /* Success state */
        <div className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-deep)] p-4">
          <p className="text-[var(--np-text-strong)] text-[13px] leading-relaxed">
            <span className="font-medium text-[var(--np-text-primary)]">Check your email</span>
            {" — "}We sent a sign-in link to{" "}
            <span className="font-medium text-[var(--np-accent-text)]">{email}</span>.
            It expires in 15 minutes.
          </p>
        </div>
      ) : (
        /* Sign-in form */
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-[var(--np-text-strong)] text-[13px] font-medium mb-1.5"
            >
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={status === "loading"}
              className="
                w-full h-9 px-3
                rounded-[var(--np-radius-md)]
                border border-[var(--np-border)]
                bg-[var(--np-surface-deep)]
                text-[var(--np-text-primary)]
                text-[13px]
                placeholder:text-[var(--np-text-muted)]
                outline-none
                transition-colors
                focus:border-[var(--np-accent)]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            {status === "error" && errorMsg && (
              <p className="mt-1.5 text-[var(--np-danger)] text-[12px]">{errorMsg}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "loading" || !email}
            className="
              w-full h-9
              rounded-[var(--np-radius-md)]
              bg-[var(--np-accent)]
              text-[var(--np-accent-fg)]
              text-[13px] font-medium
              transition-colors
              hover:bg-[var(--np-accent-hover)]
              disabled:opacity-50 disabled:cursor-not-allowed
              cursor-pointer
            "
          >
            {status === "loading" ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
      )}

      {/* Legal */}
      <p className="mt-6 text-[var(--np-text-muted)] text-[11px] text-center leading-relaxed">
        By signing in, you agree to our{" "}
        <a
          href="/terms"
          className="text-[var(--np-text-body)] underline underline-offset-2 hover:text-[var(--np-text-strong)] transition-colors"
        >
          Terms
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          className="text-[var(--np-text-body)] underline underline-offset-2 hover:text-[var(--np-text-strong)] transition-colors"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
