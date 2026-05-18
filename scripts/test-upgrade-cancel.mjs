/**
 * Tests customer.subscription.updated (upgrade/downgrade) and
 * customer.subscription.deleted (cancellation) webhook paths.
 *
 * Usage:
 *   node scripts/test-upgrade-cancel.mjs upgrade <subId> <tier>   # e.g. upgrade sub_xxx pro
 *   node scripts/test-upgrade-cancel.mjs cancel  <subId>
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
const TEST_USER_ID   = "8727a55c-fa99-4ad4-bed9-8c7db74ed2e4"
const PORT           = process.env.PORT ?? "3001"
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

const [, , cmd, subId, tierArg] = process.argv

async function getCustomerForSub(sid) {
  const sub = await stripe.subscriptions.retrieve(sid)
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id
}

async function fire(type, dataObject) {
  const payload = JSON.stringify({
    id: `evt_local_${Date.now()}`,
    object: "event",
    api_version: "2026-04-22.dahlia",
    type,
    data: { object: dataObject },
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

async function printState() {
  const sub  = await sql`SELECT tier, status FROM subscriptions WHERE user_id = ${TEST_USER_ID}`
  const ents = await sql`SELECT feature, value FROM entitlements WHERE user_id = ${TEST_USER_ID} ORDER BY feature`
  console.log(`DB tier: ${sub[0]?.tier ?? "null"}, status: ${sub[0]?.status ?? "none"}`)
  console.log(`Entitlements (${ents.length} rows): ${ents.map(e => e.feature).join(", ")}`)
}

if (cmd === "upgrade") {
  const priceId = PRICE_IDS[tierArg]
  if (!priceId) { console.error(`Unknown tier: ${tierArg}`); process.exit(1) }
  const customerId = await getCustomerForSub(subId)
  const periodEnd  = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60

  console.log(`Firing subscription.updated → ${tierArg} (sub: ${subId})`)
  const { status, body } = await fire("customer.subscription.updated", {
    id: subId,
    object: "subscription",
    status: "active",
    customer: customerId,
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: priceId } }] },
  })
  console.log(`HTTP ${status}: ${body}`)
  await new Promise(r => setTimeout(r, 500))
  await printState()

} else if (cmd === "cancel") {
  const customerId = await getCustomerForSub(subId)
  console.log(`Firing subscription.deleted (sub: ${subId})`)
  const { status, body } = await fire("customer.subscription.deleted", {
    id: subId,
    object: "subscription",
    status: "canceled",
    customer: customerId,
    items: { data: [{ price: { id: PRICE_IDS.pro } }] },
  })
  console.log(`HTTP ${status}: ${body}`)
  await new Promise(r => setTimeout(r, 500))
  await printState()

} else {
  console.error("Usage: test-upgrade-cancel.mjs upgrade <subId> <tier>")
  console.error("       test-upgrade-cancel.mjs cancel  <subId>")
  process.exit(1)
}

await sql.end()
