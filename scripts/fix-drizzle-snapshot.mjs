/**
 * Fix drizzle snapshot drift (#52).
 *
 * Runs drizzle-kit generate to produce an accurate 0002_snapshot.json, then
 * replaces the generated SQL with a no-op comment so drizzle-kit migrate
 * can "apply" it without re-running already-applied DDL.
 *
 * Why keep the journal entry + SQL (not delete them):
 *   drizzle-kit uses _journal.json to locate the latest snapshot — the highest
 *   idx entry points to 0002_snapshot.json. Deleting idx=2 makes drizzle-kit
 *   fall back to 0001_snapshot.json (pre-drift state) and the fix is undone.
 *
 * Why the SQL is a comment, not empty:
 *   An empty file or comment-only file is valid SQL postgres executes as a no-op.
 *   drizzle-kit migrate marks it applied in __drizzle_migrations; done.
 *
 * Usage (no DATABASE_URL needed — generate reads only the TypeScript schema):
 *   node scripts/fix-drizzle-snapshot.mjs
 *
 * After running: commit drizzle/meta/_journal.json + 0002_snapshot.json + 0002_*.sql
 */
import { execSync } from "child_process"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, "..")
const metaDir  = resolve(webRoot, "drizzle", "meta")
const journalPath = resolve(metaDir, "_journal.json")

// Provide a syntactically valid placeholder so drizzle.config.ts parses without error.
// generate never connects to the DB — it diffs the TypeScript schema against the snapshot.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://placeholder:5432/placeholder"
  console.log("DATABASE_URL not set — using placeholder (generate does not connect to DB)")
}

const journalBefore = JSON.parse(readFileSync(journalPath, "utf8"))
const idxBefore = journalBefore.entries.length

console.log("Running drizzle-kit generate --name reconcile-post-t4 ...")
try {
  execSync("npx drizzle-kit generate --name reconcile-post-t4", {
    cwd: webRoot,
    stdio: "inherit",
    env: process.env,
  })
} catch (e) {
  console.error("\ndrizzle-kit generate failed:", e.message)
  console.error("If it tried to connect to the DB, run with a real DATABASE_URL:")
  console.error("  DATABASE_URL=\"<public_url>\" node scripts/fix-drizzle-snapshot.mjs")
  process.exit(1)
}

// Verify a new journal entry was written
const journalAfter = JSON.parse(readFileSync(journalPath, "utf8"))
if (journalAfter.entries.length <= idxBefore) {
  console.error("No new journal entry found — generate may have detected no diff. Check schema/index.ts matches the DB.")
  process.exit(1)
}

const latest = journalAfter.entries[journalAfter.entries.length - 1]
const sqlPath = resolve(webRoot, "drizzle", `${latest.tag}.sql`)
const snapshotName = `${String(latest.idx).padStart(4, "0")}_snapshot.json`

if (!existsSync(sqlPath)) {
  console.error(`Expected SQL file not found: ${sqlPath}`)
  process.exit(1)
}

// Replace with no-op comment — valid SQL, does nothing when migrate runs it
writeFileSync(
  sqlPath,
  [
    "-- Snapshot baseline (#52): all DDL in this range applied via hand scripts",
    "-- (0001_user_dockets through 0005_filing_dockets + seed-caiso-source).",
    "-- This file is intentionally a no-op; use apply-sql.mjs for schema changes.",
    "",
  ].join("\n"),
  "utf8",
)

console.log(`\n✓ Replaced ${latest.tag}.sql with no-op comment`)
console.log(`✓ Snapshot: drizzle/meta/${snapshotName} (accurate diff base for future generate)`)
console.log(`✓ Journal: idx=${latest.idx} → ${latest.tag}`)
console.log("\nCommit: drizzle/meta/_journal.json, drizzle/meta/" + snapshotName + ", drizzle/" + latest.tag + ".sql")
