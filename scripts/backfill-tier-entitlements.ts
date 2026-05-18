/**
 * Backfill script — run once after the P1 migration.
 *
 * For every active subscription row:
 *   1. Retrieve the Stripe subscription to get the current price ID.
 *   2. Resolve the price ID to a tier via resolveTier().
 *   3. Update subscriptions.tier.
 *   4. Delete-and-reinsert all entitlement rows for the user.
 *
 * Safe to re-run (idempotent). The delete-and-reinsert pattern means
 * running it twice yields the same DB state as running it once.
 *
 * Usage:
 *   railway run --service nodalpulse-web tsx scripts/backfill-tier-entitlements.ts
 */

import { db } from "@/db/client"
import { subscriptions } from "@/db/schema"
import { eq } from "drizzle-orm"
import Stripe from "stripe"
import { resolveTier } from "@/lib/tiers"
import { applyTierEntitlements } from "@/lib/entitlements"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" })

async function main() {
  const active = await db
    .select({
      userId: subscriptions.userId,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"))

  console.log(`Found ${active.length} active subscription(s) to backfill.`)

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const row of active) {
    if (!row.stripeSubscriptionId) {
      console.warn(`  SKIP ${row.userId}: no stripeSubscriptionId`)
      skipped++
      continue
    }

    let priceId: string | undefined
    try {
      const stripeSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
        expand: ["items"],
      })
      priceId = stripeSub.items.data[0]?.price?.id
    } catch (err) {
      console.error(`  FAIL ${row.userId}: Stripe retrieve error —`, err)
      failed++
      continue
    }

    if (!priceId) {
      console.warn(`  SKIP ${row.userId}: no price ID on Stripe subscription`)
      skipped++
      continue
    }

    const tier = resolveTier(priceId)
    if (!tier) {
      console.warn(`  SKIP ${row.userId}: unrecognised price ID ${priceId}`)
      skipped++
      continue
    }

    try {
      await db
        .update(subscriptions)
        .set({ tier })
        .where(eq(subscriptions.userId, row.userId))

      await applyTierEntitlements(row.userId, priceId, row.currentPeriodEnd ?? null)

      console.log(`  OK   ${row.userId}: tier=${tier}, priceId=${priceId}`)
      ok++
    } catch (err) {
      console.error(`  FAIL ${row.userId}: DB write error —`, err)
      failed++
    }
  }

  console.log(`\nBackfill complete: ${ok} ok, ${skipped} skipped, ${failed} failed.`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error("Fatal:", err)
  process.exit(1)
})
