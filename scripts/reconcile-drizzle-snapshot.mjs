/**
 * One-time script to reconcile drizzle's snapshot/journal with the live DB.
 * Run AFTER applying all pending migrations (T3 + T4).
 *
 * Run locally — do NOT invoke via `railway run`, which injects the internal
 * postgres.railway.internal host that your laptop cannot resolve.
 *
 * Usage:
 *   node scripts/reconcile-drizzle-snapshot.mjs
 *
 * Or with an explicit URL (no .env.local needed):
 *   DATABASE_URL="postgres://..." node scripts/reconcile-drizzle-snapshot.mjs
 *
 * What it does:
 * - Runs drizzle-kit introspect against the live DB (needs the public DATABASE_URL)
 * - Updates drizzle/meta/_journal.json with a fresh baseline snapshot entry
 * - Removes generated drizzle/schema.ts (project uses db/schema/index.ts instead)
 * - After this, drizzle-kit generate produces accurate diffs with no phantom re-adds
 */
import { execSync } from "child_process"
import { readFileSync, existsSync, unlinkSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, "..")

// Load .env.local if present — drizzle.config.ts reads process.env.DATABASE_URL,
// and execSync inherits process.env, so this passes the public URL to drizzle-kit.
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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — add it to .env.local or export it before running")
  process.exit(1)
}

console.log("Running drizzle-kit introspect against live DB...")
try {
  execSync("npx drizzle-kit introspect", {
    cwd: webRoot,
    stdio: "inherit",
    env: process.env,
  })
} catch (e) {
  console.error("drizzle-kit introspect failed:", e.message)
  process.exit(1)
}

// introspect generates drizzle/schema.ts — not needed (project uses db/schema/index.ts)
const generatedSchema = resolve(webRoot, "drizzle", "schema.ts")
if (existsSync(generatedSchema)) {
  unlinkSync(generatedSchema)
  console.log("Removed generated drizzle/schema.ts")
}

console.log("\nDone. drizzle/meta/ now reflects live DB state.")
console.log("Commit: drizzle/meta/_journal.json and any new *_snapshot.json files")
console.log("Future drizzle-kit generate calls will produce accurate diffs.")
