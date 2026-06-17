import { db } from "@/db/client"
import { entitlements, subscriptions } from "@/db/schema"
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { type Tier, TIER_ENTITLEMENTS, resolveTier, resolveAddonMarket } from "@/lib/tiers"

export interface EntitlementSet {
  tier: Tier | null
  dailyBrief: boolean
  marketAccess: string[]                 // ["PUCT","ERCOT","CAISO","PJM"] — entitled markets
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

  // Collect entitled markets from all "market_access:<MARKET>" rows (post-self-heal).
  const marketAccess = Object.keys(byFeature)
    .filter(f => f.startsWith("market_access:"))
    .map(f => f.slice("market_access:".length))

  return {
    tier,
    dailyBrief:     "daily_brief"   in byFeature,
    marketAccess,
    trackedDockets: { limit: dockets  !== undefined ? dockets.limit  : 0 },
    savedSearches:  { limit: searches !== undefined ? searches.limit : 0 },
    briefHistory:   { days: history   !== undefined ? history.days   : 0 },
    qa:             { limitPerDay: qa !== undefined ? qa.limit_per_day : 0 },
    teamSeats:      { limit: seats?.limit ?? 0 },
    auditExport:    "audit_export" in byFeature,
    apiAccess:      "api_access"   in byFeature,
  }
}

// ---------------------------------------------------------------------------
// applySubscriptionEntitlements
// Core of the #119 add-on architecture. Called by the Stripe webhook on every
// subscription event with ALL items in the sub (base tier + any add-ons).
//
// Strategy:
//   1. Separate items into one base-tier item and zero-or-more add-on items.
//   2. Build entitlement rows: tier rows (source='tier') from TIER_ENTITLEMENTS,
//      addon rows (source='addon') for each add-on market.
//   3. Delete only source IN ('tier','addon') for this user — beta_grandfather
//      rows are never touched.
//   4. Insert the freshly computed rows. Idempotent: safe to call on every
//      webhook event (renewal, upgrade, downgrade, trial→active).
//
// Throws if no item resolves to a known tier.
// ---------------------------------------------------------------------------

export interface SubItem {
  priceId:          string
  currentPeriodEnd: number | null  // unix timestamp; null for unknown
}

export async function applySubscriptionEntitlements(
  userId: string,
  items: SubItem[],
  defaultExpiresAt: Date | null,
): Promise<void> {
  // --- 1. Resolve base tier + add-on markets from the items list ---
  let tier: Tier | null = null
  const addonMarkets: string[] = []

  for (const item of items) {
    const t = resolveTier(item.priceId)
    if (t) { tier = t; continue }

    const market = resolveAddonMarket(item.priceId)
    if (market) addonMarkets.push(market)
  }

  if (!tier) {
    throw new Error(
      `applySubscriptionEntitlements: no base tier found in items [${items.map(i => i.priceId).join(", ")}]`
    )
  }

  // --- 2. Build rows ---
  const tierRows = TIER_ENTITLEMENTS[tier].map(e => ({
    userId,
    feature:   e.feature,
    value:     e.value,
    expiresAt: defaultExpiresAt,
    source:    "tier" as const,
  }))

  const addonRows = addonMarkets.map(market => ({
    userId,
    feature:   `market_access:${market}`,
    value:     {} as Record<string, unknown>,
    expiresAt: defaultExpiresAt,
    source:    "addon" as const,
  }))

  const allRows = [...tierRows, ...addonRows]

  // --- 3. Delete only tier+addon rows (beta_grandfather rows survive) ---
  await db
    .delete(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        inArray(entitlements.source, ["tier", "addon"]),
      )
    )

  // --- 4. Insert fresh rows ---
  if (allRows.length > 0) {
    await db.insert(entitlements).values(allRows)
  }
}

// ---------------------------------------------------------------------------
// applyTierEntitlements (compat wrapper)
// Used by: backfill-tier-entitlements.ts, onboardBetaUser (via explicit call).
// Wraps applySubscriptionEntitlements with a single-item view so the callers
// that only know the priceId don't need to change.
// ---------------------------------------------------------------------------
export async function applyTierEntitlements(
  userId: string,
  priceId: string,
  expiresAt: Date | null,
): Promise<void> {
  const tier = resolveTier(priceId)
  if (!tier) throw new Error(`Unknown price ID: ${priceId}`)

  await applySubscriptionEntitlements(
    userId,
    [{ priceId, currentPeriodEnd: expiresAt ? Math.floor(expiresAt.getTime() / 1000) : null }],
    expiresAt,
  )
}
