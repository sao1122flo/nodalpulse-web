/**
 * Applies P7 migration: api_keys table for Org-tier API access.
 * Uses the public Railway DATABASE_URL (ssl: require).
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

const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL not set"); process.exit(1) }

const sql = postgres(url, { ssl: "require" })

try {
  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label        text NOT NULL,
      key_prefix   text NOT NULL,
      key_hash     text NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      revoked_at   timestamptz
    )
  `
  console.log("OK: api_keys table")

  await sql`
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
      ON api_keys (user_id)
      WHERE revoked_at IS NULL
  `
  console.log("OK: idx_api_keys_user_id")

  await sql`
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix
      ON api_keys (key_prefix)
      WHERE revoked_at IS NULL
  `
  console.log("OK: idx_api_keys_prefix")

  const [col] = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'api_keys'
  `
  if (col) {
    console.log("Verified: api_keys exists")
  } else {
    console.error("FAIL: table not found after migration")
    process.exit(1)
  }
} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
