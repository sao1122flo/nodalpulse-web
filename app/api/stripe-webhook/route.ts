import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { headers } from "next/headers"

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
    case "checkout.session.completed":
      // TODO: provision subscription entitlements
      break
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // TODO: sync subscription status
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}
