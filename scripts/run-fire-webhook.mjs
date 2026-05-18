/**
 * Loads .env.local then runs fire-webhook.mjs with the same process args.
 * Usage: node scripts/run-fire-webhook.mjs <subscriptionId> [userId]
 */
import { readFileSync } from "fs"
import { createRequire } from "module"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env.local")

const raw = readFileSync(envPath, "utf8")
for (const line of raw.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const idx = trimmed.indexOf("=")
  if (idx < 0) continue
  const key = trimmed.slice(0, idx).trim()
  const val = trimmed.slice(idx + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

// Now dynamically import fire-webhook.mjs (it reads process.argv[2..])
await import("./fire-webhook.mjs")
