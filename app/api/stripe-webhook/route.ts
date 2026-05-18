import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { headers } from "next/headers"
import { db } from "@/db/client"
import { entitlements, subscriptions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { applyTierEntitlements } from "@/lib/entitlements"
import { resolveTier } from "@/lib/tiers"

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
      // Covered by checkout.session.completed for Hosted Checkout flows.
      break
    }

    case "invoice.payment_succeeded": {
      // Available for receipt emails or per-renewal entitlement refresh in future prompts.
      break
    }

    case "invoice.payment_failed": {
      // Stripe retries and moves the subscription to past_due / unpaid.
      // customer.subscription.updated handles the status sync.
      break
    }

    case "checkout.session.completed": {
      const session = event.data.object
      const userId = session.client_reference_id
      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : null
      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : null

      if (!userId || !stripeCustomerId || !stripeSubscriptionId) break

      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["latest_invoice", "items"],
      })

      const priceId = stripeSub.items.data[0]?.price?.id
      if (!priceId) {
        console.error(
          "checkout.session.completed: no price ID on subscription",
          stripeSubscriptionId
        )
        break
      }

      const tier = resolveTier(priceId)
      if (!tier) {
        console.error("checkout.session.completed: unrecognised price ID", priceId)
        break
      }

      const rawEnd = (stripeSub as unknown as { current_period_end?: number })
        .current_period_end
      const invEnd =
        typeof stripeSub.latest_invoice === "object" &&
        stripeSub.latest_invoice !== null &&
        "period_end" in stripeSub.latest_invoice
          ? (stripeSub.latest_invoice as { period_end: number }).period_end
          : null
      const expiresAt = rawEnd
        ? new Date(rawEnd * 1000)
        : invEnd
          ? new Date(invEnd * 1000)
          : null

      await db
        .insert(subscriptions)
        .values({
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: "active",
          tier,
          currentPeriodEnd: expiresAt,
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: { stripeCustomerId, stripeSubscriptionId, status: "active", tier, currentPeriodEnd: expiresAt },
        })

      await applyTierEntitlements(userId, priceId, expiresAt)
      break
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object
      const stripeSubscriptionId = stripeSub.id
      const status = stripeSub.status
      const priceId = stripeSub.items.data[0]?.price?.id
      const tier = priceId ? resolveTier(priceId) : null

      const rawEnd = (stripeSub as unknown as { current_period_end?: number })
        .current_period_end
      const currentPeriodEnd = rawEnd ? new Date(rawEnd * 1000) : null

      const [row] = await db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      if (!row) break

      await db
        .update(subscriptions)
        .set({ status, tier, currentPeriodEnd })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      // Re-apply entitlements on every update — handles upgrades, downgrades,
      // renewals, and cancel-at-period-end (same tier, same expiresAt, idempotent).
      if (priceId) {
        await applyTierEntitlements(row.userId, priceId, currentPeriodEnd)
      }

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
        .set({ status: "cancelled", tier: null })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      // Hard-delete all entitlement rows. expiresAt was already at period end,
      // but this catches immediate cancellations and keeps the table clean.
      await db.delete(entitlements).where(eq(entitlements.userId, row.userId))

      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
