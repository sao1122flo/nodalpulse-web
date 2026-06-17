/**
 * #119 one-time script: mark existing market_access entitlement rows as
 * source='beta_grandfather' so the webhook recompute loop never overwrites them.
 *
 * Run AFTER deploying the 0006_entitlements_source migration and BEFORE
 * flipping BETA_MARKETS_FREE=false or deploying the new webhook handler.
 * Safe to re-run (UPDATE WHERE source='tier' is a no-op on already-tagged rows).
 *
 * Usage:
 *   railway run --service nodalpulse-web tsx scripts/mark-beta-grandfather.ts
 */

import { db } from "@/db/client"
import { entitlements } from "@/db/schema"
import { and, eq, like } from "drizzle-orm"

async function main() {
  console.log("=== mark-beta-grandfather ===")
  console.log("Tagging existing market_access rows (source='tier') as 'beta_grandfather'...")

  const result = await db
    .update(entitlements)
    .set({ source: "beta_grandfather" })
    .where(
      and(
        like(entitlements.feature, "market_access:%"),
        eq(entitlements.source, "tier"),
      )
    )

  // postgres-js returns the row count in the result
  const rowCount = Array.isArray(result) ? result.length : (result as unknown as { count?: number }).count ?? "?"
  console.log(`Updated ${rowCount} row(s).`)

  // Verification: show counts per market
  const rows = await db
    .select({ feature: entitlements.feature, source: entitlements.source })
    .from(entitlements)
    .where(like(entitlements.feature, "market_access:%"))

  const summary: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    const f = r.feature as string
    const s = r.source as string
    if (!summary[f]) summary[f] = {}
    summary[f][s] = (summary[f][s] ?? 0) + 1
  }

  console.log("\nVerification — market_access rows by feature × source:")
  for (const [feature, counts] of Object.entries(summary)) {
    const parts = Object.entries(counts).map(([src, n]) => `${src}:${n}`).join(", ")
    console.log(`  ${feature}: ${parts}`)
  }

  console.log("\nDone. All current beta users' market_access rows are now 'beta_grandfather'.")
  console.log("The webhook recompute will not touch these rows.")
}

main().catch(err => {
  console.error("Fatal:", err)
  process.exit(1)
})
