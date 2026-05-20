/**
 * Applies P5 migration: llm_calls.conversation_id column for Q&A session tracking.
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
    ALTER TABLE llm_calls
    ADD COLUMN IF NOT EXISTS conversation_id uuid
  `
  console.log("OK: llm_calls.conversation_id")

  await sql`
    CREATE INDEX IF NOT EXISTS idx_llm_calls_conversation
    ON llm_calls (conversation_id)
    WHERE conversation_id IS NOT NULL
  `
  console.log("OK: idx_llm_calls_conversation")

  // Verify
  const [col] = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'llm_calls' AND column_name = 'conversation_id'
  `
  if (col) {
    console.log("Verified:", col.column_name, col.data_type)
  } else {
    console.error("FAIL: column not found after migration")
    process.exit(1)
  }
} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
