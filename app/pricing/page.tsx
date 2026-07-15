import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getEntitlements } from "@/lib/entitlements"
import {
  TIER_DISPLAY,
  FEATURE_MATRIX,
  type Tier,
} from "@/lib/tiers"
import { createTieredCheckoutSession, createPortalSessionFromPricing } from "./actions"

export const metadata: Metadata = {
  title: "Pricing — NodalPulse",
  description:
    "NodalPulse pricing: Starter ($99/mo), Pro ($249/mo), Team ($749/mo), Org ($1,999/mo). 14-day free trial — no card required. One regulatory market of your choice included; add more in-app.",
}

const COLS = ["free", "pro", "team", "org"] as const

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; checkout?: string; return?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const params = await searchParams
  const preselected = (params.tier ?? null) as Tier | null
  const checkoutDone = params.checkout === "success"

  // Redirect to return path on successful checkout, if one was preserved.
  if (checkoutDone && params.return) {
    const raw = params.return
    // Re-validate at read time: relative path only, no protocol-relative URLs.
    if (raw.startsWith("/") && !raw.includes("//")) {
      redirect(raw)
    }
  }

  const entitlements = session
    ? await getEntitlements(session.user.id)
    : null

  const currentTier = entitlements?.tier ?? null

  // Preserve the return path for checkout links — whitelist same as actions.ts.
  const returnPath =
    params.return && params.return.startsWith("/") && !params.return.includes("//")
      ? params.return
      : undefined

  return (
    <div className="min-h-screen bg-[var(--np-surface)]">
      <div className="max-w-[1120px] mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <h1
            className="
              text-[var(--np-text-primary)] font-semibold
              text-3xl tracking-tight mb-3
            "
          >
            Simple, transparent pricing
          </h1>
          <p className="text-[var(--np-text-muted)] text-[15px]">
            14-day free trial · no card required · cancel anytime
          </p>
          <p className="text-[var(--np-text-muted)] text-[13px] mt-1">
            If you add a card, your plan activates automatically on day&nbsp;15.
            No card = trial ends, no charge.
          </p>
          {checkoutDone && (
            <div
              className="
                mt-4 inline-flex items-center gap-2 px-4 py-2
                rounded-full border border-[rgba(34,197,94,0.25)]
                bg-[rgba(34,197,94,0.08)] text-[var(--np-success)]
                text-[13px] font-medium
              "
            >
              Subscription activated — welcome aboard.
            </div>
          )}
        </div>

        {/* Tier cards */}
        <div className="flex flex-col gap-3 mb-10 lg:grid lg:grid-cols-5 lg:gap-px lg:bg-[var(--np-border)] lg:border lg:border-[var(--np-border)] lg:rounded-[var(--np-radius-lg)] lg:overflow-hidden">

          {/* Free column */}
          <div className="bg-[var(--np-surface)] px-5 py-6 flex flex-col gap-3 border border-[var(--np-border)] rounded-[var(--np-radius-lg)] lg:border-0 lg:rounded-none">
            <div className="text-[13px] font-semibold text-[var(--np-text-strong)] tracking-wide mt-1">
              Free
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[22px] font-semibold text-[var(--np-text-primary)] tabular-nums">
                $0
              </span>
            </div>
            {session ? (
              currentTier === null ? (
                <span
                  className="
                    w-full text-center py-2 px-3 rounded-[var(--np-radius-md)]
                    border border-[var(--np-border)] text-[var(--np-text-body)]
                    text-[13px] font-medium
                  "
                >
                  Current plan
                </span>
              ) : (
                <a
                  href="/pricing"
                  className="
                    w-full text-center py-2 px-3 rounded-[var(--np-radius-md)]
                    border border-[var(--np-border)] text-[var(--np-text-muted)]
                    text-[13px] hover:text-[var(--np-text-body)] transition-colors
                  "
                >
                  Free tier
                </a>
              )
            ) : (
              <a
                href="/login"
                className="
                  w-full text-center py-2 px-3 rounded-[var(--np-radius-md)]
                  border border-[var(--np-border)] text-[var(--np-text-body)]
                  text-[13px] hover:border-[var(--np-border-strong)] transition-colors
                "
              >
                Sign up free
              </a>
            )}
          </div>

          {/* Paid tier columns */}
          {TIER_DISPLAY.map(td => {
            const isHighlighted = td.highlight || preselected === td.tier
            const isCurrentPlan = currentTier === td.tier

            return (
              <div
                key={td.tier}
                className={`
                  relative px-5 flex flex-col gap-3
                  border border-[var(--np-border)] rounded-[var(--np-radius-lg)]
                  lg:border-0 lg:rounded-none
                  ${isHighlighted
                    ? "pt-10 pb-6 lg:py-6 bg-[var(--np-indigo-50)]"
                    : "py-6 bg-[var(--np-surface)]"
                  }
                `}
              >
                {td.highlight && (
                  <div
                    className="
                      absolute top-0 left-1/2 -translate-x-1/2
                      bg-[var(--np-indigo-600)] text-white
                      text-[10px] font-semibold uppercase tracking-widest
                      px-3 py-0.5 rounded-b-[var(--np-radius-sm)]
                    "
                  >
                    Most popular
                  </div>
                )}

                <div
                  className={`
                    text-[13px] font-semibold tracking-wide mt-1
                    ${isHighlighted
                      ? "text-[#312e81]"
                      : "text-[var(--np-text-strong)]"
                    }
                  `}
                >
                  {td.name}
                </div>

                <div className="flex items-baseline gap-0.5">
                  <span className={`text-[22px] font-semibold tabular-nums ${isHighlighted ? "text-[#1e1b4b]" : "text-[var(--np-text-primary)]"}`}>
                    {td.price}
                  </span>
                  <span className={`text-[13px] ${isHighlighted ? "text-[#312e81]" : "text-[var(--np-text-muted)]"}`}>{td.period}</span>
                </div>

                <TierCTA
                  tier={td.tier}
                  contactOnly={td.contactOnly}
                  currentTier={currentTier}
                  isLoggedIn={!!session}
                  isPreselected={preselected === td.tier}
                  isHighlighted={isHighlighted}
                  returnPath={returnPath}
                />
              </div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div
          className="
            border border-[var(--np-border)] rounded-[var(--np-radius-lg)]
            overflow-x-auto mb-16
          "
        >
          <table className="w-full min-w-[600px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--np-border-strong)] bg-[var(--np-surface-elevated)]">
                <th
                  className="
                    text-left px-5 py-3 font-semibold text-[12px] uppercase
                    tracking-widest text-[var(--np-text-strong)] w-[160px]
                    sticky left-0 z-10 bg-[var(--np-surface-elevated)]
                  "
                >
                  Feature
                </th>
                {COLS.map(col => (
                  <th
                    key={col}
                    className={`
                      text-center px-4 py-3 font-semibold text-[13px]
                      border-l border-[var(--np-border)]
                      ${col === "pro" || preselected === col
                        ? "bg-[var(--np-indigo-50)] text-[#312e81]"
                        : "text-[var(--np-text-strong)]"
                      }
                    `}
                  >
                    {col === "free" ? "Free" : TIER_DISPLAY.find(t => t.tier === col)?.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map(row => (
                <tr
                  key={row.label}
                  className="group border-b border-[var(--np-border)] last:border-0 hover:bg-[var(--np-surface-elevated)]"
                >
                  <td className="px-5 py-3 sticky left-0 z-10 bg-[var(--np-surface)] group-hover:bg-[var(--np-surface-elevated)]">
                    <span className="text-[var(--np-text-body)] font-medium">{row.label}</span>
                    {row.note && (
                      <p className="text-[var(--np-text-muted)] text-[11px] mt-0.5">{row.note}</p>
                    )}
                  </td>
                  {COLS.map(col => {
                    const val = row.values[col]
                    return (
                      <td
                        key={col}
                        className={`
                          text-center px-4 py-3
                          border-l border-[var(--np-border)]
                          ${val === "—"
                            ? (col === "pro" || preselected === col ? "text-[var(--np-text-body)]" : "text-[var(--np-text-muted)]")
                            : "text-[var(--np-text-primary)]"}
                          ${col === "pro" || preselected === col
                            ? "bg-[color-mix(in_srgb,var(--np-indigo-50)_40%,transparent)]"
                            : ""
                          }
                        `}
                      >
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom CTA */}
        {!session && (
          <div className="text-center">
            <a
              href="/login?callbackURL=%2Fpricing%3Ftier%3Dpro"
              className="
                inline-flex items-center justify-center
                h-11 px-6 rounded-[var(--np-radius-md)]
                bg-[var(--np-accent)] text-[var(--np-accent-fg)]
                text-[14px] font-medium
                hover:bg-[var(--np-accent-hover)] transition-colors
              "
            >
              Start your 14-day free trial &rarr;
            </a>
            <p className="mt-2 text-[var(--np-text-muted)] text-[12px]">
              No card required. 14-day free trial.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CTA cell — isolated so the Server Action forms stay clean
// ---------------------------------------------------------------------------
function TierCTA({
  tier,
  contactOnly,
  currentTier,
  isLoggedIn,
  isPreselected,
  isHighlighted,
  returnPath,
}: {
  tier: Tier
  contactOnly: boolean
  currentTier: Tier | null
  isLoggedIn: boolean
  isPreselected: boolean
  isHighlighted?: boolean
  returnPath?: string
}) {
  const baseBtn = `
    w-full text-center py-2 px-3 text-[13px] font-medium
    rounded-[var(--np-radius-md)] transition-colors
  `

  if (contactOnly) {
    return (
      <a
        href="mailto:hello@nodalpulse.com"
        className={`${baseBtn} border border-[var(--np-border)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]`}
      >
        Contact us
      </a>
    )
  }

  if (currentTier === tier) {
    return (
      <span
        className={`${baseBtn} border border-[var(--np-border)] cursor-default ${isHighlighted ? "text-[#312e81]" : "text-[var(--np-text-body)]"}`}
      >
        Current plan
      </span>
    )
  }

  // Free needs no checkout — it's the default for any account. Sign up / go to app.
  if (tier === "free") {
    return (
      <a
        href={isLoggedIn ? "/dashboard" : "/login"}
        className={`${baseBtn} border border-[var(--np-border)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]`}
      >
        {isLoggedIn ? "Go to app" : "Get started free"}
      </a>
    )
  }

  if (isLoggedIn && currentTier !== null) {
    // Existing subscriber — send to billing portal for plan management.
    // Portal handles upgrades/downgrades without creating a duplicate subscription.
    return (
      <form action={createPortalSessionFromPricing}>
        <button
          type="submit"
          className={`${baseBtn} border border-[var(--np-border)] hover:border-[var(--np-border-strong)] cursor-pointer ${isHighlighted ? "text-[#312e81]" : "text-[var(--np-text-body)]"}`}
        >
          Switch to {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </button>
      </form>
    )
  }

  if (isLoggedIn) {
    // No active subscription — direct checkout
    const action = createTieredCheckoutSession.bind(null, tier, returnPath)
    return (
      <form action={action}>
        <button
          type="submit"
          className={`
            ${baseBtn} cursor-pointer
            ${isPreselected
              ? "bg-[var(--np-accent)] text-[var(--np-accent-fg)] hover:bg-[var(--np-accent-hover)] border border-transparent"
              : "border border-[var(--np-accent)] text-[var(--np-accent-text)] hover:bg-[var(--np-accent)] hover:text-white"
            }
          `}
        >
          {isPreselected ? "Complete purchase" : "Start trial"}
        </button>
      </form>
    )
  }

  // Logged out — link to login with tier + return preserved in callbackURL
  const pricingParams = returnPath
    ? `/pricing?tier=${tier}&return=${encodeURIComponent(returnPath)}`
    : `/pricing?tier=${tier}`
  const callbackURL = encodeURIComponent(pricingParams)
  return (
    <a
      href={`/login?callbackURL=${callbackURL}`}
      className={`
        ${baseBtn}
        ${tier === "pro"
          ? "bg-[var(--np-accent)] text-[var(--np-accent-fg)] hover:bg-[var(--np-accent-hover)] border border-transparent"
          : "border border-[var(--np-border)] text-[var(--np-text-body)] hover:border-[var(--np-border-strong)]"
        }
      `}
    >
      Start trial
    </a>
  )
}
