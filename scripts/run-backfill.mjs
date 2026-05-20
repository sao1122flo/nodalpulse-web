/**
 * Loads .env.local then runs backfill-tier-entitlements via tsx.
 * Avoids the railway run internal-hostname issue.
 */
import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env.local")
const raw = readFileSync(envPath, "utf8")
const env = { ...process.env }

for (const line of raw.split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const idx = t.indexOf("=")
  if (idx < 0) continue
  const key = t.slice(0, idx).trim()
  env[key] = t.slice(idx + 1).trim()
}

console.log(`DATABASE_URL host: ${new URL(env.DATABASE_URL).host}`)
execSync("npx tsx scripts/backfill-tier-entitlements.ts", { env, stdio: "inherit", cwd: resolve(__dirname, "..") })
