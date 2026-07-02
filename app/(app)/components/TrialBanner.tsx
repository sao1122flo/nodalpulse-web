import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { subscriptions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/stripe"
import { createPortalSessionFromPricing } from "@/app/pricing/actions"

export async function TrialBanner() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const [sub] = await db
    .select({
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      stripeCustomerId: subscriptions.stripeCustomerId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1)

  if (sub?.status !== "trialing" || !sub.currentPeriodEnd) return null

  // Check whether the customer already has a card on file so we don't
  // keep showing "add a card" to someone who already did.
  let hasCard = false
  if (sub.stripeCustomerId) {
    const pms = await stripe.paymentMethods.list({
      customer: sub.stripeCustomerId,
      type: "card",
      limit: 1,
    })
    hasCard = pms.data.length > 0
  }

  const daysLeft = Math.max(
    0,
    Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000),
  )

  // Display guard: a real trial is 14 days. An implausibly long remaining window
  // (comp accounts / a provisioning bug that set a multi-month trial) renders as a
  // broken-looking "183 days left" countdown — worse than no banner. Suppress the
  // urgency banner outside the real trial-end window. NOTE: this only fixes the
  // DISPLAY; the underlying trial length lives in Stripe/subscriptions and is tracked
  // separately (new signups must be provisioned with a 14-day trial, not months).
  if (daysLeft > 30) return null

  const daysLabel =
    daysLeft === 0
      ? "Your trial ends today"
      : daysLeft === 1
        ? "1 day left in your trial"
        : `${daysLeft} days left in your trial`

  return (
    <div
      className="
        mt-4 flex items-center justify-between gap-4
        rounded-[var(--np-radius-md)]
        border border-[var(--np-accent)] border-opacity-30
        bg-[var(--np-accent-fill)]
        px-4 py-2.5
      "
    >
      {hasCard ? (
        <p className="text-[13px] text-[var(--np-text-body)]">
          <span className="font-medium text-[var(--np-text-strong)]">{daysLabel}</span>
          {" — "}
          your card will be charged when the trial ends.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-[var(--np-text-body)]">
            <span className="font-medium text-[var(--np-text-strong)]">{daysLabel}</span>
            {" — "}
            add a card to keep receiving your daily briefs.
          </p>
          <form action={createPortalSessionFromPricing} className="flex-shrink-0">
            <button
              type="submit"
              className="text-[12px] font-medium text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors cursor-pointer"
            >
              Add a card →
            </button>
          </form>
        </>
      )}
    </div>
  )
}
