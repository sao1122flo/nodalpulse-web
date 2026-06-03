/**
 * Generic SQL file runner for hand-applied migrations.
 * Reads DATABASE_URL from .env.local (local dev) or process.env (CI/explicit override).
 * Run locally — do NOT invoke via `railway run`, which injects the internal
 * postgres.railway.internal host that your laptop cannot resolve.
 *
 * Usage:
 *   node scripts/apply-sql.mjs drizzle/0004_dockets_jurisdiction.sql
 *   node scripts/apply-sql.mjs drizzle/0005_filing_dockets.sql
 *
 * Or with an explicit URL (no .env.local needed):
 *   DATABASE_URL="postgres://..." node scripts/apply-sql.mjs drizzle/0005_filing_dockets.sql
 */
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import postgres from "postgres"

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, "..")

// Load .env.local if present (only sets vars not already in env, same as run-p*.mjs pattern)
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

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error("Usage: node scripts/apply-sql.mjs <path-to-sql-file>")
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL not set — add it to .env.local or export it before running")
  process.exit(1)
}

const filePath = resolve(webRoot, sqlFile)
let sqlContent
try {
  sqlContent = readFileSync(filePath, "utf8")
} catch (e) {
  console.error(`Cannot read ${filePath}: ${e.message}`)
  process.exit(1)
}

const sql = postgres(url, { ssl: "require" })
try {
  console.log(`Applying: ${sqlFile}`)
  await sql.unsafe(sqlContent)
  console.log("OK")
} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
