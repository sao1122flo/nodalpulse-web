import { db } from "@/db/client"
import { entitlements, subscriptions } from "@/db/schema"
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { type Tier, TIER_ENTITLEMENTS, resolveTier, ALL_MARKETS } from "@/lib/tiers"

export interface EntitlementSet {
  tier: Tier                             // always set — "free" is the floor, never null
  dailyBrief: boolean
  marketAccess: string[]                 // always ALL_MARKETS — markets never gate
  trackedDockets:   { limit: number | null }
  aiActions:        { perMonth: number | null }  // monthly AI-action quota; null = unlimited
  watchedEntities:  { limit: number | null }
  savedSearches:    { limit: number | null }
  briefHistory:     { days: number | null }
  teamSeats:        { limit: number }
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

  // Floor at Free: any account with no paid subscription resolves to the Free tier.
  const paidTier = (subRows[0]?.tier ?? null) as Tier | null
  const tier: Tier = paidTier ?? "free"
  const byFeature = Object.fromEntries(entRows.map(r => [r.feature, r.value ?? {}]))

  // Self-heal from TIER_ENTITLEMENTS[tier]. For Free this materializes the whole set
  // even with zero DB rows (Free needs no subscription/entitlement rows). For paid
  // tiers it fills any feature added after the user subscribed; the next webhook
  // event persists them.
  for (const ent of TIER_ENTITLEMENTS[tier]) {
    if (!(ent.feature in byFeature)) byFeature[ent.feature] = ent.value
  }

  const dockets  = byFeature["tracked_dockets"]  as { limit: number | null }     | undefined
  const ai       = byFeature["ai_actions"]       as { per_month: number | null } | undefined
  const watched  = byFeature["watched_entities"] as { limit: number | null }     | undefined
  const searches = byFeature["saved_searches"]   as { limit: number | null }     | undefined
  const history  = byFeature["brief_history"]    as { days: number | null }      | undefined
  const seats    = byFeature["team_seats"]        as { limit: number }            | undefined

  return {
    tier,
    dailyBrief:      "daily_brief" in byFeature,
    // Markets NEVER gate — every account (Free included) gets every market.
    marketAccess:    [...ALL_MARKETS],
    trackedDockets:  { limit: dockets  !== undefined ? dockets.limit    : 0 },
    aiActions:       { perMonth: ai    !== undefined ? ai.per_month     : 0 },
    watchedEntities: { limit: watched  !== undefined ? watched.limit    : 0 },
    savedSearches:   { limit: searches !== undefined ? searches.limit   : 0 },
    briefHistory:    { days: history   !== undefined ? history.days     : 0 },
    teamSeats:       { limit: seats?.limit ?? 1 },
    auditExport:     "audit_export" in byFeature,
    apiAccess:       "api_access"   in byFeature,
  }
}

// ---------------------------------------------------------------------------
// applySubscriptionEntitlements
// Called by the Stripe webhook on every subscription event. Under the usage-gated
// model there are no market add-ons — a subscription resolves to exactly one tier,
// and that tier includes every market. (The old per-market add-on path is gone.)
//
//   1. Resolve the base tier from the items list.
//   2. Build tier rows (source='tier') from TIER_ENTITLEMENTS.
//   3. Delete only source IN ('tier','addon') for this user — beta_grandfather
//      rows are never touched.
//   4. Insert the fresh rows (onConflictDoNothing: a grandfather row wins its slot).
// ---------------------------------------------------------------------------

export interface SubItem {
  priceId:          string
  currentPeriodEnd: number | null
}

export async function applySubscriptionEntitlements(
  userId: string,
  items: SubItem[],
  defaultExpiresAt: Date | null,
): Promise<void> {
  let tier: Tier | null = null
  for (const item of items) {
    const t = resolveTier(item.priceId)
    if (t) { tier = t; break }
  }

  if (!tier) {
    throw new Error(
      `applySubscriptionEntitlements: no tier found in items [${items.map(i => i.priceId).join(", ")}]`
    )
  }

  const tierRows = TIER_ENTITLEMENTS[tier].map(e => ({
    userId,
    feature:   e.feature,
    value:     e.value,
    expiresAt: defaultExpiresAt,
    source:    "tier" as const,
  }))

  // Delete only tier+addon rows (beta_grandfather rows survive). 'addon' is kept in
  // the filter so any legacy add-on rows are cleaned up on the next event.
  await db
    .delete(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        inArray(entitlements.source, ["tier", "addon"]),
      )
    )

  if (tierRows.length > 0) {
    await db.insert(entitlements).values(tierRows).onConflictDoNothing()
  }
}

// ---------------------------------------------------------------------------
// applyTierEntitlements (compat wrapper) — used by backfill + onboarding.
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
