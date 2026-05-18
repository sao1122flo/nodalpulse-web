"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { db } from "@/db/client"
import { subscriptions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { type Tier } from "@/lib/tiers"

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nodalpulse.com"

const PRICE_ENV: Record<Tier, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro:     "STRIPE_PRICE_PRO",
  team:    "STRIPE_PRICE_TEAM",
  org:     "STRIPE_PRICE_ORG",
}

export async function createTieredCheckoutSession(tier: Tier) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthenticated")

  if (tier === "org") {
    throw new Error("Org tier requires direct sales contact — use mailto:hello@nodalpulse.com")
  }

  const priceId = process.env[PRICE_ENV[tier]]
  if (!priceId) throw new Error(`${PRICE_ENV[tier]} is not configured`)

  const [sub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1)

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(sub?.stripeCustomerId
      ? { customer: sub.stripeCustomerId }
      : { customer_email: session.user.email }),
    client_reference_id: session.user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/pricing?checkout=success&tier=${tier}`,
    cancel_url:  `${appUrl()}/pricing?tier=${tier}`,
  })

  redirect(checkoutSession.url!)
}
