"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveProfile } from "./actions"
import { BRIEF_DELIVERY_COPY } from "@/lib/copy"

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
  { value: "all", label: "All ERCOT" },
  { value: "north", label: "North" },
  { value: "houston", label: "Houston" },
  { value: "west", label: "West" },
  { value: "south", label: "South" },
]

const TOTAL_STEPS = 3

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [role, setRole] = useState("")
  const [markets, setMarkets] = useState<string[]>(["all"])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function toggleMarket(value: string) {
    setMarkets(prev => {
      if (value === "all") {
        return prev.includes("all") ? [] : ["all"]
      }
      const withoutAll = prev.filter(m => m !== "all")
      return withoutAll.includes(value)
        ? withoutAll.filter(m => m !== value)
        : [...withoutAll, value]
    })
  }

  async function handleFinish() {
    setSaving(true)
    setError("")
    try {
      await saveProfile({ role, markets, docketIds: [] })
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--np-surface)] py-12 px-4">
      <div className="w-full max-w-[560px]">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">
              &#9632;
            </span>
            <span className="font-bold text-[var(--np-text-primary)] text-base tracking-tight">
              NodalPulse
            </span>
          </div>

          {step < TOTAL_STEPS && (
            <>
              <h1 className="text-[var(--np-text-primary)] text-xl font-semibold mb-1">
                Set up your account
              </h1>
              <p className="text-[var(--np-text-muted)] text-[13px]">
                Takes about 60 seconds. You can change everything later.
              </p>

              {/* Step indicator */}
              <div className="flex items-center gap-1.5 mt-4">
                {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => {
                  const stepNum = i + 1
                  const active = stepNum === step
                  const done = stepNum < step
                  return (
                    <div
                      key={stepNum}
                      className={`h-1.5 rounded-full transition-all ${
                        active
                          ? "w-6 bg-[var(--np-accent)]"
                          : done
                          ? "w-6 bg-[var(--np-accent-text)] opacity-60"
                          : "w-6 bg-[var(--np-border-strong)]"
                      }`}
                    />
                  )
                })}
                <span className="text-[var(--np-text-muted)] text-[11px] ml-1">
                  Step {step} of {TOTAL_STEPS - 1}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Card */}
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] p-6">

          {/* ── Step 1: Role ── */}
          {step === 1 && (
            <div>
              <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-1">
                What best describes your role?
              </h2>
              <p className="text-[var(--np-text-muted)] text-[13px] mb-4">
                This helps us tailor your daily brief.
              </p>
              <div className="flex flex-col gap-2">
                {MARKET_ROLES.map(r => (
                  <label
                    key={r}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-[var(--np-radius-md)]
                      border cursor-pointer transition-colors
                      ${role === r
                        ? "border-[var(--np-accent)] bg-[var(--np-accent-fill)] text-[var(--np-text-primary)]"
                        : "border-[var(--np-border)] bg-[var(--np-surface-deep)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="sr-only"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                        role === r
                          ? "border-[var(--np-accent)] bg-[var(--np-accent)]"
                          : "border-[var(--np-border-strong)] bg-transparent"
                      }`}
                    />
                    <span className="text-[13px]">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Markets ── */}
          {step === 2 && (
            <div>
              <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-1">
                Which ERCOT zones do you care about?
              </h2>
              <p className="text-[var(--np-text-muted)] text-[13px] mb-4">
                Select all that apply. Your brief will focus on relevant filings.
              </p>
              <div className="flex flex-col gap-2">
                {ERCOT_ZONES.map(zone => {
                  const checked = markets.includes(zone.value)
                  return (
                    <label
                      key={zone.value}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-[var(--np-radius-md)]
                        border cursor-pointer transition-colors
                        ${checked
                          ? "border-[var(--np-accent)] bg-[var(--np-accent-fill)] text-[var(--np-text-primary)]"
                          : "border-[var(--np-border)] bg-[var(--np-surface-deep)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMarket(zone.value)}
                        className="sr-only"
                      />
                      <span
                        className={`
                          w-3.5 h-3.5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center
                          ${checked
                            ? "border-[var(--np-accent)] bg-[var(--np-accent)]"
                            : "border-[var(--np-border-strong)] bg-transparent"
                          }
                        `}
                      >
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path
                              d="M1.5 4L3.5 6L6.5 2"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="text-[13px]">{zone.label}</span>
                    </label>
                  )
                })}
              </div>

              {error && (
                <p className="mt-3 text-[var(--np-danger)] text-[12px]">{error}</p>
              )}
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && (
            <div className="text-center py-4">
              <div
                className="w-10 h-10 rounded-full bg-[var(--np-accent-fill)] border border-[var(--np-accent)] flex items-center justify-center mx-auto mb-4"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M3.5 9.5L7 13L14.5 5"
                    stroke="var(--np-accent)"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-[var(--np-text-primary)] font-semibold text-[15px] mb-2">
                You&apos;re all set
              </h2>
              <p className="text-[var(--np-text-body)] text-[13px] leading-relaxed mb-6">
                {BRIEF_DELIVERY_COPY}
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="
                  inline-flex items-center justify-center
                  h-9 px-5
                  rounded-[var(--np-radius-md)]
                  bg-[var(--np-accent)]
                  text-[var(--np-accent-fg)]
                  text-[13px] font-medium
                  hover:bg-[var(--np-accent-hover)]
                  transition-colors cursor-pointer
                "
              >
                Go to dashboard
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < TOTAL_STEPS && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              className="
                h-9 px-4
                rounded-[var(--np-radius-md)]
                border border-[var(--np-border)]
                text-[var(--np-text-body)] text-[13px]
                hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)]
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-colors cursor-pointer
              "
            >
              Back
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!role}
                className="
                  h-9 px-5
                  rounded-[var(--np-radius-md)]
                  bg-[var(--np-accent)]
                  text-[var(--np-accent-fg)] text-[13px] font-medium
                  hover:bg-[var(--np-accent-hover)]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors cursor-pointer
                "
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="
                  h-9 px-5
                  rounded-[var(--np-radius-md)]
                  bg-[var(--np-accent)]
                  text-[var(--np-accent-fg)] text-[13px] font-medium
                  hover:bg-[var(--np-accent-hover)]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors cursor-pointer
                "
              >
                {saving ? "Saving…" : "Finish setup"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
