"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { trackDocket } from "@/app/(app)/dockets/actions"
import {
  saveRole,
  saveMarkets,
  advanceOnboarding,
  createSavedSearch,
  deleteSavedSearch,
  fireBrief,
  getBriefStatus,
  type BriefPollStatus,
  type OnboardingState,
} from "./actions"
import type { SavedSearchQuery } from "@/db/schema"

// ---------------------------------------------------------------------------
// Constants — environment-driven so e2e tests can shorten the wait
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS  = Number(process.env.NEXT_PUBLIC_ONBOARDING_POLL_MS  ?? 2_000)
const POLL_TIMEOUT_MS   = Number(process.env.NEXT_PUBLIC_ONBOARDING_TIMEOUT_MS ?? 45_000)

const MARKET_ROLES = [
  "Regulatory Analyst",
  "Compliance Officer",
  "Energy Lawyer",
  "BESS Regulatory Lead",
  "Trader / Risk Manager",
  "Consultant / Advisory",
  "Utility / Co-op Staff",
  "Developer / IPP",
  "Other",
]

const ERCOT_ZONES = [
  { value: "all",     label: "All ERCOT" },
  { value: "north",   label: "North" },
  { value: "houston", label: "Houston" },
  { value: "west",    label: "West" },
  { value: "south",   label: "South" },
]

const TOTAL_STEPS = 5  // 1=Role 2=Markets 3=Dockets 4=Searches 5=Brief

// ---------------------------------------------------------------------------
// Small shared primitives
// ---------------------------------------------------------------------------

function StepPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--np-accent-fill)] text-[var(--np-accent-text)] border border-[var(--np-accent)] border-opacity-30">
      {label}
    </span>
  )
}

function LimitBar({ used, limit, noun }: { used: number; limit: number | null; noun: string }) {
  if (limit === null) return null
  return (
    <p className="text-[var(--np-text-muted)] text-[12px] mt-2">
      {used} of {limit} {noun} used
    </p>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface Props {
  initialStep: number
  initialState: OnboardingState
}

export function OnboardingClient({ initialStep, initialState }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(initialStep)
  const [isPending, startTransition] = useTransition()

  // Step 1
  const [role, setRole] = useState("")

  // Step 2
  const [markets, setMarkets] = useState<string[]>(["all"])

  // Step 3 — dockets
  const [docketInput, setDocketInput] = useState("")
  const [docketMsg, setDocketMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [trackedCount, setTrackedCount] = useState(initialState.trackedCount)

  // Step 4 — saved searches
  const [searchName, setSearchName] = useState("")
  const [searchText, setSearchText] = useState("")
  const [searchMsg, setSearchMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [searchList, setSearchList] = useState(initialState.savedSearchList)

  // Step 5 — brief
  const [briefStatus, setBriefStatus] = useState<BriefPollStatus>("pending")
  const [jobId, setJobId] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [briefError, setBriefError] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const briefDate = new Date().toISOString().slice(0, 10)

  // ---------------------------------------------------------------------------
  // Step 5: fire + poll on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (step !== 5) return

    let cancelled = false

    async function fire() {
      const result = await fireBrief()
      if (cancelled) return
      if (!result.ok) {
        setBriefError(result.error)
        setBriefStatus("failed")
        return
      }
      setJobId(result.value.jobId)
    }

    async function poll() {
      if (cancelled) return
      const { status, jobId: fid } = await getBriefStatus(briefDate)
      if (cancelled) return
      if (status === "ready") {
        setBriefStatus("ready")
        clearInterval(pollRef.current!)
        clearTimeout(timeoutRef.current!)
        await advanceOnboarding(5)
        setTimeout(() => router.push("/dashboard"), 1200)
      } else if (status === "failed") {
        setBriefStatus("failed")
        if (fid) setJobId(fid)
        clearInterval(pollRef.current!)
        clearTimeout(timeoutRef.current!)
      }
    }

    fire()
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
    timeoutRef.current = setTimeout(async () => {
      if (cancelled) return
      clearInterval(pollRef.current!)
      setTimedOut(true)
      await advanceOnboarding(5)
    }, POLL_TIMEOUT_MS)

    return () => {
      cancelled = true
      clearInterval(pollRef.current!)
      clearTimeout(timeoutRef.current!)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  function next(s: number) { setStep(s) }

  // ---------------------------------------------------------------------------
  // Market toggle (step 2)
  // ---------------------------------------------------------------------------
  function toggleMarket(value: string) {
    setMarkets(prev => {
      if (value === "all") return prev.includes("all") ? [] : ["all"]
      const withoutAll = prev.filter(m => m !== "all")
      return withoutAll.includes(value)
        ? withoutAll.filter(m => m !== value)
        : [...withoutAll, value]
    })
  }

  // ---------------------------------------------------------------------------
  // Docket track (step 3)
  // ---------------------------------------------------------------------------
  function handleTrackDocket(e: React.FormEvent) {
    e.preventDefault()
    const dn = docketInput.trim()
    if (!dn) return
    setDocketMsg(null)
    startTransition(async () => {
      const result = await trackDocket({ docketNumber: dn })
      if (result.ok) {
        setDocketInput("")
        setTrackedCount(c => c + 1)
        setDocketMsg({ text: result.value.warming ? "Saved — extracting filings in the background." : "Docket added.", ok: true })
      } else {
        setDocketMsg({ text: result.error, ok: false })
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Saved search create (step 4)
  // ---------------------------------------------------------------------------
  function handleCreateSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchMsg(null)
    startTransition(async () => {
      const query: SavedSearchQuery = searchText.trim() ? { text: searchText.trim() } : {}
      const result = await createSavedSearch(searchName, query)
      if (result.ok) {
        setSearchList(prev => [...prev, { id: result.value.id, name: searchName.trim(), query, notify: true }])
        setSearchName("")
        setSearchText("")
        setSearchMsg({ text: "Saved search added.", ok: true })
      } else {
        setSearchMsg({ text: result.error, ok: false })
      }
    })
  }

  function handleDeleteSearch(id: string) {
    startTransition(async () => {
      await deleteSavedSearch(id)
      setSearchList(prev => prev.filter(s => s.id !== id))
    })
  }

  // ---------------------------------------------------------------------------
  // Shared button classes
  // ---------------------------------------------------------------------------
  const btnPrimary = `
    h-9 px-5 rounded-[var(--np-radius-md)]
    bg-[var(--np-accent)] text-[var(--np-accent-fg)] text-[13px] font-medium
    hover:bg-[var(--np-accent-hover)]
    disabled:opacity-40 disabled:cursor-not-allowed
    transition-colors cursor-pointer
  `
  const btnSecondary = `
    h-9 px-4 rounded-[var(--np-radius-md)]
    border border-[var(--np-border)]
    text-[var(--np-text-body)] text-[13px]
    hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)]
    disabled:opacity-30 disabled:cursor-not-allowed
    transition-colors cursor-pointer
  `

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--np-surface)] py-12 px-4">
      <div className="w-full max-w-[560px]">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">&#9632;</span>
            <span className="font-bold text-[var(--np-text-primary)] text-base tracking-tight">NodalPulse</span>
          </div>
          {step < TOTAL_STEPS && (
            <>
              <h1 className="text-[var(--np-text-primary)] text-xl font-semibold mb-1">Set up your account</h1>
              <p className="text-[var(--np-text-muted)] text-[13px]">Takes about 60 seconds. You can change everything later.</p>
              <div className="flex items-center gap-1.5 mt-4">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
                  const s = i + 1
                  return (
                    <div key={s} className={`h-1.5 w-6 rounded-full transition-all ${
                      s === step ? "bg-[var(--np-accent)]"
                      : s < step  ? "bg-[var(--np-accent-text)] opacity-60"
                      : "bg-[var(--np-border-strong)]"
                    }`} />
                  )
                })}
                <span className="text-[var(--np-text-muted)] text-[11px] ml-1">Step {step} of {TOTAL_STEPS}</span>
              </div>
            </>
          )}
        </div>

        {/* Card */}
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] p-6">

          {/* ── Step 1: Role ── */}
          {step === 1 && (
            <div>
              <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-1">What best describes your role?</h2>
              <p className="text-[var(--np-text-muted)] text-[13px] mb-4">This helps us tailor your daily brief.</p>
              <div className="flex flex-col gap-2">
                {MARKET_ROLES.map(r => (
                  <label key={r} className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--np-radius-md)] border cursor-pointer transition-colors ${
                    role === r
                      ? "border-[var(--np-accent)] bg-[var(--np-accent-fill)] text-[var(--np-text-primary)]"
                      : "border-[var(--np-border)] bg-[var(--np-surface-deep)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
                  }`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${role === r ? "border-[var(--np-accent)] bg-[var(--np-accent)]" : "border-[var(--np-border-strong)] bg-transparent"}`} />
                    <span className="text-[13px]">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Markets ── */}
          {step === 2 && (
            <div>
              <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-1">Which ERCOT zones do you care about?</h2>
              <p className="text-[var(--np-text-muted)] text-[13px] mb-4">Select all that apply. Your brief will focus on relevant filings.</p>
              <div className="flex flex-col gap-2">
                {ERCOT_ZONES.map(zone => {
                  const checked = markets.includes(zone.value)
                  return (
                    <label key={zone.value} className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--np-radius-md)] border cursor-pointer transition-colors ${
                      checked
                        ? "border-[var(--np-accent)] bg-[var(--np-accent-fill)] text-[var(--np-text-primary)]"
                        : "border-[var(--np-border)] bg-[var(--np-surface-deep)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
                    }`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleMarket(zone.value)} className="sr-only" />
                      <span className={`w-3.5 h-3.5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-[var(--np-accent)] bg-[var(--np-accent)]" : "border-[var(--np-border-strong)] bg-transparent"}`}>
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[13px]">{zone.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Dockets ── */}
          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px]">Track PUCT dockets</h2>
                <StepPill label="Optional" />
              </div>
              <p className="text-[var(--np-text-muted)] text-[13px] mb-4">
                Your brief will always include the latest filings for tracked dockets.
              </p>

              <form onSubmit={handleTrackDocket} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={docketInput}
                  onChange={e => setDocketInput(e.target.value)}
                  placeholder="PUCT control number (e.g. 59475)"
                  disabled={isPending}
                  className="
                    h-9 px-3 flex-1
                    rounded-[var(--np-radius-md)]
                    border border-[var(--np-border)]
                    bg-[var(--np-surface-elevated)]
                    text-[var(--np-text-body)] text-[13px]
                    placeholder:text-[var(--np-text-muted)]
                    focus:outline-none focus:border-[var(--np-border-strong)]
                    disabled:opacity-40 transition-colors
                  "
                />
                <button type="submit" disabled={isPending || !docketInput.trim()} className={btnSecondary}>
                  {isPending ? "Adding…" : "Add"}
                </button>
              </form>

              {docketMsg && (
                docketMsg.ok ? (
                  <p className="text-[12px] mb-2 text-[var(--np-text-muted)]">
                    {docketMsg.text}
                  </p>
                ) : (
                  <div className="mb-2">
                    <p className="text-[12px] text-[var(--np-danger)]">{docketMsg.text}</p>
                    {docketMsg.text.toLowerCase().includes("limit") && (
                      <a
                        href="/pricing?return=%2Fonboarding"
                        className="inline-flex items-center h-7 px-3 mt-1.5 rounded-[var(--np-radius-md)] border border-[var(--np-accent)] text-[var(--np-accent-text)] text-[12px] font-medium hover:bg-[var(--np-accent)] hover:text-white transition-colors"
                      >
                        Upgrade to track dockets →
                      </a>
                    )}
                  </div>
                )
              )}

              <LimitBar used={trackedCount} limit={initialState.trackedDocketLimit} noun="dockets" />

              {trackedCount === 0 && (
                <p className="text-[var(--np-text-muted)] text-[12px] mt-3 italic">
                  No dockets tracked yet — you can add them later from the Dockets page.
                </p>
              )}
              {trackedCount > 0 && (
                <p className="text-[var(--np-success)] text-[12px] mt-3">
                  {trackedCount} docket{trackedCount !== 1 ? "s" : ""} tracked.
                </p>
              )}
            </div>
          )}

          {/* ── Step 4: Saved searches ── */}
          {step === 4 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px]">Saved searches</h2>
                <StepPill label="Optional" />
              </div>
              <p className="text-[var(--np-text-muted)] text-[13px] mb-4">
                Searches with <em>notify</em> on are included in your daily brief automatically.
              </p>

              {initialState.savedSearchLimit === 0 ? (
                /* Free-user upsell */
                <div className="rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-deep)] px-4 py-4 text-center">
                  <p className="text-[var(--np-text-body)] text-[13px] mb-3">
                    Saved searches are available on paid plans.
                  </p>
                  <a
                    href="/pricing?return=%2Fonboarding"
                    className="inline-flex items-center h-8 px-4 rounded-[var(--np-radius-md)] bg-[var(--np-accent)] text-[var(--np-accent-fg)] text-[13px] font-medium hover:bg-[var(--np-accent-hover)] transition-colors"
                  >
                    View plans →
                  </a>
                </div>
              ) : (
                /* Paid-user creation form */
                <form onSubmit={handleCreateSearch} className="flex flex-col gap-2 mb-4">
                  <input
                    type="text"
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                    placeholder="Search name (e.g. BESS interconnection)"
                    disabled={isPending}
                    className="
                      h-9 px-3
                      rounded-[var(--np-radius-md)]
                      border border-[var(--np-border)]
                      bg-[var(--np-surface-elevated)]
                      text-[var(--np-text-body)] text-[13px]
                      placeholder:text-[var(--np-text-muted)]
                      focus:outline-none focus:border-[var(--np-border-strong)]
                      disabled:opacity-40 transition-colors
                    "
                  />
                  <input
                    type="text"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder="Keywords (optional)"
                    disabled={isPending}
                    className="
                      h-9 px-3
                      rounded-[var(--np-radius-md)]
                      border border-[var(--np-border)]
                      bg-[var(--np-surface-elevated)]
                      text-[var(--np-text-body)] text-[13px]
                      placeholder:text-[var(--np-text-muted)]
                      focus:outline-none focus:border-[var(--np-border-strong)]
                      disabled:opacity-40 transition-colors
                    "
                  />
                  <button
                    type="submit"
                    disabled={isPending || !searchName.trim()}
                    className={`${btnSecondary} self-start`}
                  >
                    {isPending ? "Saving…" : "Add search"}
                  </button>
                </form>
              )}

              {searchMsg && (
                <p className={`text-[12px] mb-2 ${searchMsg.ok ? "text-[var(--np-text-muted)]" : "text-[var(--np-danger)]"}`}>
                  {searchMsg.text}
                </p>
              )}

              <LimitBar used={searchList.length} limit={initialState.savedSearchLimit} noun="saved searches" />

              {searchList.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {searchList.map(s => (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 rounded-[var(--np-radius-md)] border border-[var(--np-border)] bg-[var(--np-surface-deep)]">
                      <span className="text-[13px] text-[var(--np-text-body)]">{s.name}</span>
                      <button
                        onClick={() => handleDeleteSearch(s.id)}
                        disabled={isPending}
                        className="text-[var(--np-text-muted)] text-[12px] hover:text-[var(--np-danger)] transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Step 5: First brief ── */}
          {step === 5 && (
            <div className="text-center py-4">
              {briefStatus === "pending" && !timedOut && (
                <>
                  <div className="w-10 h-10 rounded-full border-2 border-[var(--np-accent)] border-t-transparent animate-spin mx-auto mb-4" />
                  <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-2">Generating your first brief…</h2>
                  <p className="text-[var(--np-text-muted)] text-[13px]">This usually takes 20–30 seconds.</p>
                </>
              )}

              {briefStatus === "ready" && (
                <>
                  <div className="w-10 h-10 rounded-full bg-[var(--np-accent-fill)] border border-[var(--np-accent)] flex items-center justify-center mx-auto mb-4">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M3.5 9.5L7 13L14.5 5" stroke="var(--np-accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-2">Brief ready!</h2>
                  <p className="text-[var(--np-text-muted)] text-[13px]">Taking you to your dashboard…</p>
                </>
              )}

              {(briefStatus === "failed" || timedOut) && (
                <>
                  <div className="w-10 h-10 rounded-full bg-[var(--np-surface-deep)] border border-[var(--np-border)] flex items-center justify-center mx-auto mb-4">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 5v5M9 13h.01" stroke="var(--np-text-muted)" strokeWidth="1.75" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-2">
                    {timedOut ? "Still working on it" : "Brief generation failed"}
                  </h2>
                  <p className="text-[var(--np-text-body)] text-[13px] leading-relaxed mb-4">
                    {timedOut
                      ? "We're on it — you'll receive your brief by email within the hour."
                      : briefError || "Something went wrong. Your brief will be retried automatically."}
                  </p>
                  {jobId && (
                    <p className="text-[var(--np-text-muted)] text-[11px] font-mono mb-4">Job: {jobId}</p>
                  )}
                  <a
                    href="/dashboard"
                    className={`inline-flex items-center justify-center ${btnPrimary}`}
                  >
                    Go to dashboard
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < TOTAL_STEPS && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1 || isPending}
              className={btnSecondary}
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              {/* Skip button for optional steps */}
              {step === 3 && (
                <button
                  onClick={() => startTransition(async () => { await advanceOnboarding(3); next(4) })}
                  disabled={isPending}
                  className={btnSecondary}
                >
                  Skip
                </button>
              )}
              {step === 4 && (
                <button
                  onClick={() => startTransition(async () => { await advanceOnboarding(4); next(5) })}
                  disabled={isPending}
                  className={btnSecondary}
                >
                  Skip
                </button>
              )}

              {/* Next / primary action */}
              {step === 1 && (
                <button
                  onClick={() => startTransition(async () => { await saveRole(role); next(2) })}
                  disabled={!role || isPending}
                  className={btnPrimary}
                >
                  Next
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={() => startTransition(async () => { await saveMarkets(markets); next(3) })}
                  disabled={isPending}
                  className={btnPrimary}
                >
                  Next
                </button>
              )}
              {step === 3 && (
                <button
                  onClick={() => startTransition(async () => { await advanceOnboarding(3); next(4) })}
                  disabled={isPending}
                  className={btnPrimary}
                >
                  {trackedCount === 0 ? "Continue without dockets" : "Next"}
                </button>
              )}
              {step === 4 && (
                <button
                  onClick={() => startTransition(async () => { await advanceOnboarding(4); next(5) })}
                  disabled={isPending}
                  className={btnPrimary}
                >
                  {searchList.length === 0 ? "Continue without searches" : "Next"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
