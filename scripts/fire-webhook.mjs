/**
 * Fires a signed checkout.session.completed webhook event to the local dev server.
 * Uses our real Stripe test subscription IDs so resolveTier() gets the correct price.
 *
 * Usage:
 *   node scripts/fire-webhook.mjs <subscriptionId> [userId]
 *
 * Example:
 *   node scripts/fire-webhook.mjs sub_1TYKUeRPKgdCHG3OOSk9Tqkj 8727a55c-fa99-4ad4-bed9-8c7db74ed2e4
 */

import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" })

const subId    = process.argv[2]
const userId   = process.argv[3] ?? "8727a55c-fa99-4ad4-bed9-8c7db74ed2e4"
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const port     = process.env.PORT ?? "3001"

if (!subId)           { console.error("Usage: fire-webhook.mjs <subscriptionId> [userId]"); process.exit(1) }
if (!webhookSecret)   { console.error("STRIPE_WEBHOOK_SECRET not set"); process.exit(1) }

// Retrieve the real subscription so we have correct price, customer, period_end
const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items", "latest_invoice"] })
const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id

const payload = JSON.stringify({
  id: `evt_local_${Date.now()}`,
  object: "event",
  api_version: "2026-04-22.dahlia",
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_local_${Date.now()}`,
      object: "checkout.session",
      mode: "subscription",
      payment_status: "paid",
      status: "complete",
      client_reference_id: userId,
      customer: customerId,
      subscription: subId,
    },
  },
})

// Use Stripe SDK's own header generator so the signature matches constructEvent exactly
const ts = Math.floor(Date.now() / 1000)
const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: webhookSecret,
  timestamp: ts,
})

const res = await fetch(`http://localhost:${port}/api/stripe-webhook`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "stripe-signature": signature,
  },
  body: payload,
})

const body = await res.text()
console.log(`HTTP ${res.status}: ${body}`)
if (res.status !== 200) process.exit(1)
