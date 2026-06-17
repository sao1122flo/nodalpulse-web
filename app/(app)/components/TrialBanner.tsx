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

  const daysLabel =
    daysLeft === 0
      ? "Hoy termina tu prueba"
      : daysLeft === 1
        ? "Te queda 1 día de prueba"
        : `Te quedan ${daysLeft} días de prueba`

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
          tu tarjeta se cobrará al terminar el trial.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-[var(--np-text-body)]">
            <span className="font-medium text-[var(--np-text-strong)]">{daysLabel}</span>
            {" — "}
            agregá una tarjeta para seguir recibiendo tus briefs.
          </p>
          <form action={createPortalSessionFromPricing} className="flex-shrink-0">
            <button
              type="submit"
              className="text-[12px] font-medium text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors cursor-pointer"
            >
              Agregar tarjeta →
            </button>
          </form>
        </>
      )}
    </div>
  )
}
