/**
 * T6: Enqueue a crawl-caiso job into the pg_queue.
 *
 * Run AFTER deploying T5 to Railway (worker must know about crawl-caiso handler).
 * The Railway worker will pick up the job and process it; run verify-caiso-crawl.mjs
 * once the job shows as done (check Railway logs or wait ~1 minute).
 *
 * Usage:
 *   node scripts/enqueue-caiso-crawl.mjs [since]
 *   node scripts/enqueue-caiso-crawl.mjs 2026-06-01
 *
 * Defaults to yesterday if since is not provided.
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

const sinceArg = process.argv[2]
const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
const since = sinceArg || yesterday

const sql = postgres(url, { ssl: "require" })
try {
  const [{ id }] = await sql`
    INSERT INTO jobs (kind, payload, priority)
    VALUES ('crawl-caiso', ${sql.json({ since })}, 10)
    RETURNING id
  `
  console.log(`Enqueued crawl-caiso job: id=${id}  since=${since}`)
  console.log("Railway worker will process it within ~60s.")
  console.log("Once done, run: node scripts/verify-caiso-crawl.mjs")
} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
