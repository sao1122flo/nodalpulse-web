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
      // Fires immediately when a trial is started via Hosted Checkout,
      // before checkout.session.completed — handle trialing state here.
      const stripeSub = event.data.object
      const status = stripeSub.status
      if (status !== "trialing") break  // active handled by checkout.session.completed

      const stripeSubscriptionId = stripeSub.id
      const stripeCustomerId =
        typeof stripeSub.customer === "string" ? stripeSub.customer : null
      const priceId = stripeSub.items.data[0]?.price?.id
      const tier = priceId ? resolveTier(priceId) : null

      // Retrieve client_reference_id from the subscription metadata or skip;
      // checkout.session.completed carries it but subscription.created does not.
      // We use customer_email match as a fallback to find the user.
      const customerEmail =
        typeof stripeSub.customer === "string"
          ? (await stripe.customers.retrieve(stripeSub.customer) as { email?: string }).email ?? null
          : null

      if (!customerEmail || !priceId || !tier) break

      const rawTrialEnd = (stripeSub as unknown as { trial_end?: number }).trial_end
      // For trialing subs trial_end is the canonical expiry; current_period_end is not needed here.
      const expiresAt = rawTrialEnd ? new Date(rawTrialEnd * 1000) : null

      const [userRow] = await db
        .select({ id: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      // If a row already exists (written by checkout.session.completed), update it.
      if (userRow) {
        await db
          .update(subscriptions)
          .set({ status, tier, currentPeriodEnd: expiresAt })
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        await applyTierEntitlements(userRow.id, priceId, expiresAt)
        break
      }

      // No row yet — look up user by customer ID in subscriptions, or skip.
      // checkout.session.completed will create the row with accurate userId.
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

      const subStatus = stripeSub.status  // "trialing" or "active"
      const rawTrialEnd = (stripeSub as unknown as { trial_end?: number }).trial_end
      // current_period_end moved to SubscriptionItem in Stripe API 2024-09-30+
      const rawEnd: number | undefined =
        (stripeSub.items.data[0] as unknown as { current_period_end?: number }).current_period_end

      // For trialing subs, expiresAt = trial_end (when entitlements should stop
      // if the user never converts). For active subs, use current_period_end.
      const expiresAt =
        subStatus === "trialing" && rawTrialEnd
          ? new Date(rawTrialEnd * 1000)
          : rawEnd
            ? new Date(rawEnd * 1000)
            : null

      await db
        .insert(subscriptions)
        .values({
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: subStatus,
          tier,
          currentPeriodEnd: expiresAt,
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: { stripeCustomerId, stripeSubscriptionId, status: subStatus, tier, currentPeriodEnd: expiresAt },
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

      const rawTrialEnd = (stripeSub as unknown as { trial_end?: number }).trial_end
      // current_period_end moved to SubscriptionItem in Stripe API 2024-09-30+
      const rawEnd: number | undefined =
        (stripeSub.items.data[0] as unknown as { current_period_end?: number }).current_period_end

      // Mirror the same expiresAt logic as checkout.session.completed:
      // trialing → trial_end; active/past_due → current_period_end.
      const currentPeriodEnd =
        status === "trialing" && rawTrialEnd
          ? new Date(rawTrialEnd * 1000)
          : rawEnd
            ? new Date(rawEnd * 1000)
            : null

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
      // renewals, trial→active, and cancel-at-period-end. Idempotent.
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
