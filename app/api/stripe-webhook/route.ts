import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { headers } from "next/headers"
import { db } from "@/db/client"
import { entitlements, subscriptions } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { applySubscriptionEntitlements, type SubItem } from "@/lib/entitlements"
import { resolveTier } from "@/lib/tiers"

// Build the SubItem list from a Stripe subscription's items array.
// Each item carries its price ID and current_period_end (from the item, not the sub root
// — Stripe moved current_period_end to SubscriptionItem in API 2024-09-30+).
function subItemsFromStripe(
  stripeItems: { price?: { id: string } }[],
): SubItem[] {
  return stripeItems.map(i => ({
    priceId:          i.price?.id ?? "",
    currentPeriodEnd: (i as unknown as { current_period_end?: number }).current_period_end ?? null,
  }))
}

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
      const stripeSub = event.data.object
      const status = stripeSub.status
      if (status !== "trialing") break  // active handled by checkout.session.completed

      const stripeSubscriptionId = stripeSub.id
      const priceId = stripeSub.items.data[0]?.price?.id
      const tier = priceId ? resolveTier(priceId) : null

      const customerEmail =
        typeof stripeSub.customer === "string"
          ? (await stripe.customers.retrieve(stripeSub.customer) as { email?: string }).email ?? null
          : null

      if (!customerEmail || !priceId || !tier) break

      const rawTrialEnd = (stripeSub as unknown as { trial_end?: number }).trial_end
      const expiresAt = rawTrialEnd ? new Date(rawTrialEnd * 1000) : null

      const [userRow] = await db
        .select({ id: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))

      if (userRow) {
        await db
          .update(subscriptions)
          .set({ status, tier, currentPeriodEnd: expiresAt })
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        await applySubscriptionEntitlements(
          userRow.id,
          subItemsFromStripe(stripeSub.items.data),
          expiresAt,
        )
      }
      break
    }

    case "invoice.payment_succeeded": {
      break
    }

    case "invoice.payment_failed": {
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

      const subStatus = stripeSub.status
      const rawTrialEnd = (stripeSub as unknown as { trial_end?: number }).trial_end
      const rawEnd: number | undefined =
        (stripeSub.items.data[0] as unknown as { current_period_end?: number }).current_period_end

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

      await applySubscriptionEntitlements(
        userId,
        subItemsFromStripe(stripeSub.items.data),
        expiresAt,
      )
      break
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object
      const stripeSubscriptionId = stripeSub.id
      const status = stripeSub.status
      const priceId = stripeSub.items.data[0]?.price?.id
      const tier = priceId ? resolveTier(priceId) : null

      const rawTrialEnd = (stripeSub as unknown as { trial_end?: number }).trial_end
      const rawEnd: number | undefined =
        (stripeSub.items.data[0] as unknown as { current_period_end?: number }).current_period_end

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

      // Re-apply on every update — handles upgrades, downgrades, renewals,
      // trial→active, and add-on subscription item changes. Idempotent.
      if (priceId) {
        await applySubscriptionEntitlements(
          row.userId,
          subItemsFromStripe(stripeSub.items.data),
          currentPeriodEnd,
        )
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

      // Hard-delete tier+addon rows. beta_grandfather rows survive cancellation
      // so grandfather users don't lose access if they briefly cancel/rejoin.
      // (A separate admin flow handles removing grandfather grants explicitly.)
      await db
        .delete(entitlements)
        .where(
          and(
            eq(entitlements.userId, row.userId),
            inArray(entitlements.source, ["tier", "addon"]),
          )
        )
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
