import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL not set"); process.exit(1) }

const sql = postgres(url, { ssl: "require" })

try {
  await sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier text`
  console.log("OK: subscriptions.tier")

  await sql`ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS value jsonb NOT NULL DEFAULT '{}'`
  console.log("OK: entitlements.value")

  const rows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN ('subscriptions','entitlements')
      AND column_name IN ('tier','value')
    ORDER BY table_name, column_name
  `
  console.log("Verified:", JSON.stringify(rows))
} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
