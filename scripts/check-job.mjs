import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8")
for (const line of raw.split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const idx = t.indexOf("=")
  if (idx < 0) continue
  const key = t.slice(0, idx).trim()
  if (!process.env[key]) process.env[key] = t.slice(idx + 1).trim()
}

import postgres from "postgres"
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" })

const user = await sql`
  SELECT id, email, email_verified FROM users WHERE email = 'sergio.ordonez@live.com'
`
console.log("=== user ===")
console.table(user)

if (user.length > 0) {
  const userId = user[0].id

  // Fix email_verified if still false
  if (!user[0].email_verified) {
    await sql`UPDATE users SET email_verified = true WHERE id = ${userId}`
    console.log("Fixed: email_verified set to true")
  }

  const subs = await sql`
    SELECT status, tier, current_period_end FROM subscriptions WHERE user_id = ${userId}
  `
  console.log("=== subscription ===")
  console.table(subs)

  const ents = await sql`
    SELECT feature, expires_at FROM entitlements WHERE user_id = ${userId} ORDER BY feature
  `
  console.log("=== entitlements ===")
  console.table(ents)
}

await sql.end()
