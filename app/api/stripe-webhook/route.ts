import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { headers } from "next/headers"
import { db } from "@/db/client"
import { subscriptions, entitlements } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = (await headers()).get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (e) {
    return NextResponse.json({ error: `Webhook error: ${e}` }, { status: 400 })
  }

  switch (event.type) {
    case "customer.subscription.created": {
      // Mirrors checkout.session.completed for subscriptions created outside Hosted Checkout
      // (e.g. manually via API or Stripe dashboard). No-op for now — covered by checkout.session.completed.
      break
    }

    case "invoice.payment_succeeded": {
      // Fires on every successful charge (initial + renewals).
      // Use this for receipts or per-renewal entitlement refresh if needed.
      break
    }

    case "invoice.payment_failed": {
      // Stripe will retry and eventually move the subscription to past_due / unpaid.
      // customer.subscription.updated handles the status sync — no additional action needed here.
      break
    }

    case "checkout.session.completed": {
      const session = event.data.object
      const userId = session.client_reference_id
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : null
      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : null

      if (!userId || !stripeCustomerId || !stripeSubscriptionId) break

      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["latest_invoice"],
      })
      const inv = stripeSub.latest_invoice
      const currentPeriodEnd =
        typeof inv === "object" && inv !== null && "period_end" in inv
          ? new Date((inv as { period_end: number }).period_end * 1000)
          : null

      await db
        .insert(subscriptions)
        .values({
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: "active",
          currentPeriodEnd,
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: { stripeCustomerId, stripeSubscriptionId, status: "active", currentPeriodEnd },
        })

      // Replace any existing pro entitlement for this user
      await db
        .delete(entitlements)
        .where(and(eq(entitlements.userId, userId), eq(entitlements.feature, "daily-brief")))
      await db.insert(entitlements).values({
        userId,
        feature: "daily-brief",
        expiresAt: currentPeriodEnd,
      })

      break
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object
      const stripeSubscriptionId = stripeSub.id
      const status = stripeSub.status
      // current_period_end removed from SDK v22 types; still present in event payload
      const rawEnd = (stripeSub as unknown as { current_period_end?: number }).current_period_end
      const currentPeriodEnd = rawEnd ? new Date(rawEnd * 1000) : null

      const [row] = await db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      if (!row) break

      await db
        .update(subscriptions)
        .set({ status, currentPeriodEnd })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      await db
        .update(entitlements)
        .set({ expiresAt: currentPeriodEnd })
        .where(and(eq(entitlements.userId, row.userId), eq(entitlements.feature, "daily-brief")))

      break
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object
      const stripeSubscriptionId = stripeSub.id

      const [row] = await db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      if (!row) break

      await db
        .update(subscriptions)
        .set({ status: "cancelled" })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      // Expire the entitlement immediately on cancellation
      await db
        .update(entitlements)
        .set({ expiresAt: new Date() })
        .where(and(eq(entitlements.userId, row.userId), eq(entitlements.feature, "daily-brief")))

      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
