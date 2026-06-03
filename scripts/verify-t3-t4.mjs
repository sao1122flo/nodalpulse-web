/**
 * Verify T3 (dockets.jurisdiction), T4 (filing_dockets), and T5 (caiso source row).
 * Usage: node scripts/verify-t3-t4.mjs
 */
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import postgres from "postgres"

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, "..")

const envPath = resolve(webRoot, ".env.local")
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const idx = t.indexOf("=")
    if (idx < 0) continue
    const key = t.slice(0, idx).trim()
    if (!process.env[key]) process.env[key] = t.slice(idx + 1).trim()
  }
}

const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL not set"); process.exit(1) }

const sql = postgres(url, { ssl: "require" })

try {
  // T3: jurisdiction distribution
  console.log("=== T3: dockets.jurisdiction ===")
  const jurisdictions = await sql`
    SELECT jurisdiction, COUNT(*)::int AS count
    FROM dockets
    GROUP BY jurisdiction
    ORDER BY count DESC
  `
  console.table(jurisdictions)

  // T4: filing_dockets columns
  console.log("\n=== T4: filing_dockets columns ===")
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'filing_dockets'
    ORDER BY ordinal_position
  `
  console.table(cols)

  // T4: indexes
  console.log("\n=== T4: filing_dockets indexes ===")
  const idxs = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'filing_dockets'
    ORDER BY indexname
  `
  console.table(idxs)

  // T4: FK constraints
  console.log("\n=== T4: filing_dockets foreign keys ===")
  const fks = await sql`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name  AS references_table,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'filing_dockets'
      AND tc.constraint_type = 'FOREIGN KEY'
  `
  console.table(fks)

  // T5: source rows — both ferc and caiso must exist or crawl handlers no-op silently
  console.log("\n=== T5: sources table (ferc + caiso) ===")
  const sources = await sql`
    SELECT slug, label, base_url
    FROM sources
    WHERE slug IN ('ferc', 'caiso')
    ORDER BY slug
  `
  console.table(sources)
  if (sources.length < 2) {
    const found = sources.map(s => s.slug)
    const missing = ['ferc','caiso'].filter(s => !found.includes(s))
    console.error("MISSING source rows:", missing, "— run apply-sql.mjs for the seed file")
  } else {
    console.log("OK: both ferc and caiso source rows present")
  }

} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
