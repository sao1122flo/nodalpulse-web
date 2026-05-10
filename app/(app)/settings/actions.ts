"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { db } from "@/db/client"
import { subscriptions } from "@/db/schema"
import { eq } from "drizzle-orm"

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nodalpulse.com"

export async function createCheckoutSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthenticated")

  const priceId = process.env.STRIPE_PRICE_PRO
  if (!priceId) throw new Error("STRIPE_PRICE_PRO is not configured")

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
    success_url: `${appUrl()}/settings?checkout=success`,
    cancel_url: `${appUrl()}/settings`,
  })

  redirect(checkoutSession.url!)
}

export async function createPortalSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthenticated")

  const [sub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1)

  if (!sub?.stripeCustomerId) throw new Error("No Stripe customer found")

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl()}/settings`,
  })

  redirect(portalSession.url)
}
