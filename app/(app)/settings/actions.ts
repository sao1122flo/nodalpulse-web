"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { db } from "@/db/client"
import { subscriptions } from "@/db/schema"
import { eq } from "drizzle-orm"

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nodalpulse.com"

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
