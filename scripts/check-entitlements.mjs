/**
 * Check subscriptions + entitlements for a user.
 * Usage: node scripts/check-entitlements.mjs [userId]
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

import postgres from "postgres"

const userId = process.argv[2] ?? "8727a55c-fa99-4ad4-bed9-8c7db74ed2e4"
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" })

const subs = await sql`
  SELECT user_id, status, tier, stripe_subscription_id, current_period_end
  FROM subscriptions WHERE user_id = ${userId}
`
console.log("\n=== subscriptions ===")
console.table(subs)

const ents = await sql`
  SELECT feature, value, expires_at
  FROM entitlements WHERE user_id = ${userId}
  ORDER BY feature
`
console.log("\n=== entitlements ===")
console.table(ents)

await sql.end()
