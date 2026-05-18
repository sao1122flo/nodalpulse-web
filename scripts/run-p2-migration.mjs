/**
 * Applies P2 migration: saved_searches table + onboarding_step column.
 * Uses the public Railway DATABASE_URL (ssl: require) to avoid internal hostname.
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
    CREATE TABLE IF NOT EXISTS "saved_searches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "name" text NOT NULL,
      "query" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "notify" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "last_fired_at" timestamp with time zone,
      CONSTRAINT "saved_searches_user_name_unique" UNIQUE("user_id","name")
    )
  `
  console.log("OK: saved_searches table")

  const [fkExists] = await sql`
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'saved_searches_user_id_users_id_fk'
      AND table_name = 'saved_searches'
  `
  if (!fkExists) {
    await sql`
      ALTER TABLE "saved_searches"
      ADD CONSTRAINT "saved_searches_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `
  }
  console.log("OK: saved_searches FK")

  await sql`
    CREATE INDEX IF NOT EXISTS "saved_searches_user_created_idx"
    ON "saved_searches" USING btree ("user_id", "created_at")
  `
  console.log("OK: saved_searches index")

  await sql`
    ALTER TABLE "user_profiles"
    ADD COLUMN IF NOT EXISTS "onboarding_step" integer DEFAULT 0 NOT NULL
  `
  console.log("OK: user_profiles.onboarding_step")

  // Verify
  const rows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE (table_name = 'saved_searches' OR (table_name = 'user_profiles' AND column_name = 'onboarding_step'))
    ORDER BY table_name, column_name
  `
  console.log("Verified:", JSON.stringify(rows.map(r => `${r.table_name}.${r.column_name}`)))
} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
