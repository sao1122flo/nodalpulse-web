"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { MicrosoftSignInButton } from "./MicrosoftSignInButton"
import { GoogleSignInButton } from "./GoogleSignInButton"

function LoginPageInner() {
  const searchParams = useSearchParams()
  const rawCallback = searchParams.get("callbackURL") ?? "/dashboard"
  // Reject absolute URLs and protocol-relative URLs to block open-redirect via crafted login links.
  const callbackURL =
    rawCallback.startsWith("/") && !rawCallback.includes("//") ? rawCallback : "/dashboard"

  const [email, setEmail] = useState("")
  const [magicStatus, setMagicStatus] = useState<"idle" | "loading" | "sent" | "error">("idle")
  const [magicError, setMagicError] = useState("")
  const [showMagicLink, setShowMagicLink] = useState(false)

  // which OAuth provider is mid-handshake (null = none)
  const [oauthProvider, setOAuthProvider] = useState<"microsoft" | "google" | null>(null)
  const [oauthError, setOAuthError] = useState("")

  // Check for OAuth error redirected back from provider
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get("error")
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOAuthError("Sign-in cancelled. Try again?")
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const oauthBusy = oauthProvider !== null

  async function handleOAuth(provider: "microsoft" | "google") {
    setOAuthProvider(provider)
    setOAuthError("")
    const result = await authClient.signIn.social({
      provider,
      callbackURL,
    })
    if (result?.error) {
      setOAuthError("Sign-in cancelled. Try again?")
      setOAuthProvider(null)
    }
    // on success the browser navigates away; state is never reset
  }

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    setMagicStatus("loading")
    setMagicError("")

    const result = await authClient.signIn.magicLink({
      email,
      callbackURL,
    })

    if (result.error) {
      setMagicError(result.error.message ?? "Something went wrong. Please try again.")
      setMagicStatus("error")
    } else {
      setMagicStatus("sent")
    }
  }

  return (
    <div
      className="w-full max-w-[400px] mx-auto rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] p-8"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
    >
      {/* Brand */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[var(--np-accent)] text-[10px] leading-none" aria-hidden="true">
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

      {/* OAuth buttons */}
      <div className="flex flex-col gap-2.5">
        <MicrosoftSignInButton
          onClick={() => handleOAuth("microsoft")}
          loading={oauthProvider === "microsoft"}
          disabled={oauthBusy || magicStatus === "loading"}
        />
        <GoogleSignInButton
          onClick={() => handleOAuth("google")}
          loading={oauthProvider === "google"}
          disabled={oauthBusy || magicStatus === "loading"}
        />
      </div>

      {/* OAuth error */}
      {oauthError && (
        <p className="mt-2.5 text-[var(--np-text-muted)] text-[12px] text-center">
          {oauthError}
        </p>
      )}

      {/* Magic link toggle */}
      <div className="mt-5">
        {!showMagicLink ? (
          <button
            type="button"
            onClick={() => setShowMagicLink(true)}
            disabled={oauthBusy}
            className="
              w-full text-[var(--np-text-muted)] text-[12px] text-center
              hover:text-[var(--np-text-body)] transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              cursor-pointer
            "
          >
            Or email me a magic link →
          </button>
        ) : magicStatus === "sent" ? (
          <div className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-deep)] p-4">
            <p className="text-[var(--np-text-strong)] text-[13px] leading-relaxed">
              <span className="font-medium text-[var(--np-text-primary)]">Check your email</span>
              {" — "}We sent a sign-in link to{" "}
              <span className="font-medium text-[var(--np-accent-text)]">{email}</span>.
              It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} noValidate>
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
              disabled={magicStatus === "loading"}
              className="
                w-full h-9 px-3 mb-2.5
                rounded-[var(--np-radius-md)]
                border border-[var(--np-border)]
                bg-[var(--np-surface-deep)]
                text-[var(--np-text-primary)] text-[13px]
                placeholder:text-[var(--np-text-muted)]
                outline-none transition-colors
                focus:border-[var(--np-accent)]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            {magicStatus === "error" && magicError && (
              <p className="mb-2 text-[var(--np-danger)] text-[12px]">{magicError}</p>
            )}
            <button
              type="submit"
              disabled={magicStatus === "loading" || !email}
              className="
                w-full h-9
                rounded-[var(--np-radius-md)]
                bg-[var(--np-accent)]
                text-[var(--np-accent-fg)] text-[13px] font-medium
                transition-colors
                hover:bg-[var(--np-accent-hover)]
                disabled:opacity-50 disabled:cursor-not-allowed
                cursor-pointer
              "
            >
              {magicStatus === "loading" ? "Sending…" : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}
