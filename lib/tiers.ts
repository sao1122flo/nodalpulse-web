// Beta: CAISO+PJM waived for all paid tiers during Beta window.
// Flip BETA_MARKETS_FREE=false in Railway env to enforce add-on pricing at GA.
const BETA_MARKETS_FREE = process.env.BETA_MARKETS_FREE !== "false"

export type Tier = "starter" | "pro" | "team" | "org"

export interface EntitlementRow {
  feature: string
  value: Record<string, unknown>
}

// Texas (PUCT/ERCOT) is the base market for all paid tiers.
const _TEXAS_MARKETS: EntitlementRow[] = [
  { feature: "market_access:PUCT",  value: {} },
  { feature: "market_access:ERCOT", value: {} },
]

// Regional add-ons: +$49 Starter/Pro, +$99 Team — waived during Beta.
const _REGIONAL_ADDON: EntitlementRow[] = [
  { feature: "market_access:CAISO", value: {} },
  { feature: "market_access:PJM",   value: {} },
]

// Tiers during Beta get all markets; at GA non-org tiers get Texas only.
const _betaOrTexas = BETA_MARKETS_FREE
  ? [..._TEXAS_MARKETS, ..._REGIONAL_ADDON]
  : _TEXAS_MARKETS

export const TIER_ENTITLEMENTS: Record<Tier, EntitlementRow[]> = {
  starter: [
    { feature: "daily_brief",      value: {} },
    { feature: "tracked_dockets",  value: { limit: 5 } },
    { feature: "saved_searches",   value: { limit: 2 } },
    { feature: "brief_history",    value: { days: 30 } },
    { feature: "qa",               value: { limit_per_day: 10 } },
    { feature: "team_seats",       value: { limit: 1 } },
    ..._betaOrTexas,
  ],
  pro: [
    { feature: "daily_brief",      value: {} },
    { feature: "tracked_dockets",  value: { limit: 25 } },
    { feature: "saved_searches",   value: { limit: 10 } },
    { feature: "brief_history",    value: { days: 365 } },
    { feature: "qa",               value: { limit_per_day: 30 } },
    { feature: "team_seats",       value: { limit: 1 } },
    ..._betaOrTexas,
  ],
  team: [
    { feature: "daily_brief",      value: {} },
    { feature: "tracked_dockets",  value: { limit: 100 } },
    { feature: "saved_searches",   value: { limit: 50 } },
    { feature: "brief_history",    value: { days: 1095 } },
    { feature: "qa",               value: { limit_per_day: 100 } },
    { feature: "team_seats",       value: { limit: 5 } },
    { feature: "sla",              value: { uptime: 0.995 } },
    ..._betaOrTexas,
  ],
  org: [
    { feature: "daily_brief",      value: {} },
    { feature: "tracked_dockets",  value: { limit: null } },
    { feature: "saved_searches",   value: { limit: null } },
    { feature: "brief_history",    value: { days: null } },
    { feature: "qa",               value: { limit_per_day: 300 } },
    { feature: "team_seats",       value: { limit: 25 } },
    { feature: "sla",              value: { uptime: 0.999 } },
    { feature: "audit_export",     value: {} },
    { feature: "api_access",       value: {} },
    // Org always includes all markets, regardless of Beta flag.
    ..._TEXAS_MARKETS,
    ..._REGIONAL_ADDON,
  ],
}

export function resolveTier(priceId: string): Tier | null {
  if (!priceId) return null
  const candidates: [string | undefined, Tier][] = [
    [process.env.STRIPE_PRICE_STARTER, "starter"],
    [process.env.STRIPE_PRICE_PRO,     "pro"],
    [process.env.STRIPE_PRICE_TEAM,    "team"],
    [process.env.STRIPE_PRICE_ORG,     "org"],
  ]
  for (const [envVal, tier] of candidates) {
    if (envVal && envVal === priceId) return tier
  }
  return null
}

// ---------------------------------------------------------------------------
// Display data — consumed by /pricing page; derived from TIER_ENTITLEMENTS
// so the two cannot diverge.
// ---------------------------------------------------------------------------

export interface TierDisplay {
  tier: Tier
  name: string
  price: string
  period: string
  highlight: boolean
  contactOnly: boolean
}

export const TIER_DISPLAY: TierDisplay[] = [
  { tier: "starter", name: "Starter", price: "$99",    period: "/mo", highlight: false, contactOnly: false },
  { tier: "pro",     name: "Pro",     price: "$249",   period: "/mo", highlight: true,  contactOnly: false },
  { tier: "team",    name: "Team",    price: "$749",   period: "/mo", highlight: false, contactOnly: false },
  { tier: "org",     name: "Org",     price: "$1,999", period: "/mo", highlight: false, contactOnly: true  },
]

export interface FeatureRow {
  label: string
  values: Record<"free" | Tier, string>
}

const _marketLabel = BETA_MARKETS_FREE
  ? "TX + CAISO + PJM (Beta)"
  : "Texas only"

export const FEATURE_MATRIX: FeatureRow[] = [
  {
    label: "Daily brief",
    values: { free: "Public digest only", starter: "Personalized", pro: "Personalized", team: "Personalized", org: "Personalized" },
  },
  {
    label: "Markets",
    values: { free: "—", starter: _marketLabel, pro: _marketLabel, team: _marketLabel, org: "All markets" },
  },
  {
    label: "Tracked dockets",
    values: { free: "—", starter: "5", pro: "25", team: "100", org: "Unlimited" },
  },
  {
    label: "Saved searches",
    values: { free: "—", starter: "2", pro: "10", team: "50", org: "Unlimited" },
  },
  {
    label: "Brief history",
    values: { free: "—", starter: "30 days", pro: "1 year", team: "3 years", org: "Unlimited" },
  },
  {
    label: "Q&A",
    values: { free: "—", starter: "10 q/day", pro: "30 q/day", team: "100 q/day", org: "300 q/day" },
  },
  {
    label: "Team seats",
    values: { free: "—", starter: "1", pro: "1", team: "5", org: "25" },
  },
  {
    label: "Audit export",
    values: { free: "—", starter: "—", pro: "—", team: "—", org: "✓" },
  },
  {
    label: "API access",
    values: { free: "—", starter: "—", pro: "—", team: "—", org: "✓" },
  },
  {
    label: "SLA",
    values: { free: "—", starter: "—", pro: "—", team: "99.5%", org: "99.9%" },
  },
]
