/**
 * Local webhook end-to-end test.
 *
 * Creates a real Stripe test customer + subscription for each tier using our
 * actual price IDs, then fires stripe trigger checkout.session.completed with
 * the subscription ID overridden so the webhook resolves the correct tier.
 *
 * Usage:
 *   node scripts/test-webhook-local.mjs [starter|pro|team|org|upgrade|cancel]
 *
 * Prerequisites:
 *   - npm run dev on port 3001
 *   - stripe listen --forward-to localhost:3001/api/stripe-webhook
 *   - All STRIPE_PRICE_* and STRIPE_SECRET_KEY set in env
 */

import Stripe from "stripe"
import { execSync } from "child_process"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" })

const TEST_USER_ID = "8727a55c-fa99-4ad4-bed9-8c7db74ed2e4"
const TEST_EMAIL   = "sao1122@gmail.com"

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  team:    process.env.STRIPE_PRICE_TEAM,
  org:     process.env.STRIPE_PRICE_ORG,
}

const cmd = process.argv[2] ?? "starter"

async function getOrCreateCustomer() {
  const existing = await stripe.customers.list({ email: TEST_EMAIL, limit: 1 })
  if (existing.data.length > 0) {
    console.log(`Reusing customer ${existing.data[0].id}`)
    return existing.data[0].id
  }
  const cust = await stripe.customers.create({ email: TEST_EMAIL })
  console.log(`Created customer ${cust.id}`)
  return cust.id
}

async function createSubscription(customerId, priceId) {
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    trial_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
    expand: ["latest_invoice"],
  })
  console.log(`Created subscription ${sub.id} with price ${priceId}`)
  return sub
}

function trigger(overrides) {
  const flags = Object.entries(overrides)
    .map(([k, v]) => `--override "${k}=${v}"`)
    .join(" ")
  const command = `stripe trigger checkout.session.completed ${flags}`
  console.log(`\nRunning: ${command}\n`)
  try {
    const out = execSync(command, { encoding: "utf8", timeout: 20000 })
    console.log(out)
  } catch (e) {
    console.log(e.stdout ?? e.message)
  }
}

if (cmd === "cancel") {
  // Simulate subscription.deleted
  console.log("--- Simulating customer.subscription.deleted ---")
  trigger({ "subscription:customer": TEST_USER_ID })

} else if (cmd === "upgrade") {
  // Simulate upgrading to Team (subscription.updated with Team price)
  const customerId = await getOrCreateCustomer()
  const sub = await createSubscription(customerId, PRICE_IDS.team)
  console.log("\n--- Simulating customer.subscription.updated (→ Team) ---")
  const flags = {
    "subscription:id": sub.id,
    "subscription:customer": customerId,
  }
  const flagStr = Object.entries(flags).map(([k, v]) => `--override "${k}=${v}"`).join(" ")
  const command = `stripe trigger customer.subscription.updated ${flagStr}`
  console.log(`Running: ${command}\n`)
  try {
    const out = execSync(command, { encoding: "utf8", timeout: 20000 })
    console.log(out)
  } catch (e) {
    console.log(e.stdout ?? e.message)
  }

} else {
  // checkout.session.completed for a specific tier
  const tier = cmd
  const priceId = PRICE_IDS[tier]
  if (!priceId) {
    console.error(`Unknown tier: ${tier}. Use one of: ${Object.keys(PRICE_IDS).join(", ")}`)
    process.exit(1)
  }

  console.log(`\n--- Testing checkout.session.completed for tier: ${tier} ---`)
  const customerId = await getOrCreateCustomer()
  const sub = await createSubscription(customerId, priceId)

  trigger({
    "checkout_session:client_reference_id": TEST_USER_ID,
    "checkout_session:customer":             customerId,
    "checkout_session:subscription":         sub.id,
  })
}
