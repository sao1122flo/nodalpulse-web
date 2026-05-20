import { db } from "@/db/client"
import { entitlements, subscriptions } from "@/db/schema"
import { and, eq, gt, isNull, or } from "drizzle-orm"
import { type Tier, TIER_ENTITLEMENTS, resolveTier } from "@/lib/tiers"

export interface EntitlementSet {
  tier: Tier | null
  dailyBrief: boolean
  trackedDockets: { limit: number | null }
  savedSearches: { limit: number | null }
  briefHistory: { days: number | null }
  qa: { limitPerDay: number | null }
  teamSeats: { limit: number }
  auditExport: boolean
  apiAccess: boolean
}

export async function getEntitlements(userId: string): Promise<EntitlementSet> {
  const [subRows, entRows] = await Promise.all([
    db
      .select({ tier: subscriptions.tier })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1),
    db
      .select({ feature: entitlements.feature, value: entitlements.value })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date()))
        )
      ),
  ])

  const tier = (subRows[0]?.tier ?? null) as Tier | null
  const byFeature = Object.fromEntries(entRows.map(r => [r.feature, r.value ?? {}]))

  // Self-heal: if the DB entitlements row is missing features that exist in
  // TIER_ENTITLEMENTS[tier] (e.g. because a new feature was added after the user
  // subscribed), fill them in from code. The next webhook event will persist them.
  if (tier) {
    for (const ent of TIER_ENTITLEMENTS[tier]) {
      if (!(ent.feature in byFeature)) {
        byFeature[ent.feature] = ent.value
      }
    }
  }

  const dockets  = byFeature["tracked_dockets"]  as { limit: number | null } | undefined
  const searches = byFeature["saved_searches"]    as { limit: number | null } | undefined
  const history  = byFeature["brief_history"]     as { days: number | null }  | undefined
  const qa       = byFeature["qa"]                as { limit_per_day: number | null } | undefined
  const seats    = byFeature["team_seats"]        as { limit: number } | undefined

  return {
    tier,
    dailyBrief:     "daily_brief"   in byFeature,
    trackedDockets: { limit: dockets  !== undefined ? dockets.limit  : 0 },
    savedSearches:  { limit: searches !== undefined ? searches.limit : 0 },
    briefHistory:   { days: history   !== undefined ? history.days   : 0 },
    qa:             { limitPerDay: qa !== undefined ? qa.limit_per_day : 0 },
    teamSeats:      { limit: seats?.limit ?? 0 },
    auditExport:    "audit_export" in byFeature,
    apiAccess:      "api_access"   in byFeature,
  }
}

// Replaces all entitlement rows for a user based on their price ID.
// Delete-and-reinsert is idempotent — safe to call on upgrade, downgrade,
// and renewal. Throws if priceId does not resolve to a known tier.
export async function applyTierEntitlements(
  userId: string,
  priceId: string,
  expiresAt: Date | null
): Promise<void> {
  const tier = resolveTier(priceId)
  if (!tier) throw new Error(`Unknown price ID: ${priceId}`)

  await db.delete(entitlements).where(eq(entitlements.userId, userId))

  const rows = TIER_ENTITLEMENTS[tier].map(e => ({
    userId,
    feature:   e.feature,
    value:     e.value,
    expiresAt,
  }))

  await db.insert(entitlements).values(rows)
}
