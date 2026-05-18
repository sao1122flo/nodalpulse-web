/**
 * Creates a real Stripe test subscription for each tier, fires a signed
 * checkout.session.completed webhook, then prints entitlements from DB.
 *
 * Usage: node scripts/test-all-tiers.mjs [pro|team|org|all]
 */
import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env.local")
const raw = readFileSync(envPath, "utf8")
for (const line of raw.split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const idx = t.indexOf("=")
  if (idx < 0) continue
  const key = t.slice(0, idx).trim()
  if (!process.env[key]) process.env[key] = t.slice(idx + 1).trim()
}

import Stripe from "stripe"
import postgres from "postgres"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" })
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" })

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  team:    process.env.STRIPE_PRICE_TEAM,
  org:     process.env.STRIPE_PRICE_ORG,
}
const TEST_USER_ID = "8727a55c-fa99-4ad4-bed9-8c7db74ed2e4"
const TEST_EMAIL   = "sao1122@gmail.com"
const PORT         = process.env.PORT ?? "3001"
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

const cmd = process.argv[2] ?? "all"
const tiersToTest = cmd === "all" ? ["starter", "pro", "team", "org"] : [cmd]

async function getOrCreateCustomer() {
  const existing = await stripe.customers.list({ email: TEST_EMAIL, limit: 1 })
  if (existing.data.length > 0) return existing.data[0].id
  const cust = await stripe.customers.create({ email: TEST_EMAIL })
  return cust.id
}

async function createSubscription(customerId, priceId) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    trial_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
  })
}

async function fireWebhook(subId, customerId) {
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
        client_reference_id: TEST_USER_ID,
        customer: customerId,
        subscription: subId,
      },
    },
  })

  const ts = Math.floor(Date.now() / 1000)
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET, timestamp: ts })

  const res = await fetch(`http://localhost:${PORT}/api/stripe-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  })
  return { status: res.status, body: await res.text() }
}

async function checkEntitlements() {
  const rows = await sql`SELECT feature, value FROM entitlements WHERE user_id = ${TEST_USER_ID} ORDER BY feature`
  const sub  = await sql`SELECT tier, status FROM subscriptions WHERE user_id = ${TEST_USER_ID}`
  return { sub: sub[0], entitlements: rows }
}

const customerId = await getOrCreateCustomer()
console.log(`Customer: ${customerId}\n`)

for (const tier of tiersToTest) {
  const priceId = PRICE_IDS[tier]
  console.log(`\n=== Testing tier: ${tier} (price: ${priceId}) ===`)

  const sub = await createSubscription(customerId, priceId)
  console.log(`Created subscription: ${sub.id}`)

  const { status, body } = await fireWebhook(sub.id, customerId)
  console.log(`Webhook response: HTTP ${status} ${body}`)

  if (status !== 200) {
    console.error(`FAIL: webhook rejected`)
    continue
  }

  // Give DB a moment to commit
  await new Promise(r => setTimeout(r, 500))

  const { sub: dbSub, entitlements } = await checkEntitlements()
  console.log(`DB tier: ${dbSub?.tier}, status: ${dbSub?.status}`)
  console.log(`Entitlements (${entitlements.length} rows):`)
  for (const e of entitlements) console.log(`  ${e.feature}: ${JSON.stringify(e.value)}`)
}

await sql.end()
