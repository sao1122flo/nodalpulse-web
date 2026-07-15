import { db } from "@/db/client"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getEntitlements } from "@/lib/entitlements"

async function main() {
  console.log("=== #119 verify #3: getEntitlements dedup check ===\n")

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, "sao1122@gmail.com")).limit(1)
  if (!user) { console.error("User not found"); process.exit(1) }

  const ents = await getEntitlements(user.id)

  console.log("getEntitlements result:")
  console.log("  tier:", ents.tier)
  console.log("  marketAccess:", JSON.stringify(ents.marketAccess))
  console.log("  dailyBrief:", ents.dailyBrief)
  console.log("  aiActions.perMonth:", ents.aiActions.perMonth)

  // Dedup check: no market should appear twice
  const dupes = ents.marketAccess.filter((m, i) => ents.marketAccess.indexOf(m) !== i)
  if (dupes.length > 0) {
    console.error("❌ DEDUP FAIL: duplicate markets:", dupes)
    process.exit(1)
  }

  // Expected markets for beta user
  const expected = ["PUCT", "ERCOT", "CAISO", "PJM"]
  const missing = expected.filter(m => !ents.marketAccess.includes(m))
  const extra = ents.marketAccess.filter(m => !expected.includes(m))

  if (missing.length > 0) console.error("❌ Missing markets:", missing)
  else console.log("✅ All expected markets present:", expected)

  if (extra.length > 0) console.log("ℹ️  Extra markets (unexpected but not a problem):", extra)

  if (missing.length > 0) process.exit(1)
  console.log("\n✅ DEDUP PASS — no duplicate markets in getEntitlements output")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
