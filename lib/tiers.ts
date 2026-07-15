// NodalPulse pricing — single plan, usage-gated (DECIDED 2026-07-14).
//
// Markets NEVER gate: every tier includes every market. Revenue expands on USAGE —
// tracked dockets (primary value gate), AI actions/month (fair-use), seats. Reads are
// unmetered at every tier. The connector ships on every tier, Free included.
// Numbers are launch config, validated in 0.1 — not immutable.
//
// Supersedes the old per-market model (starter/pro/team/org + market_access add-ons).

export type Tier = "free" | "pro" | "team" | "org"

export interface EntitlementRow {
  feature: string
  value: Record<string, unknown>
}

// Every tier includes every market — adding a market is free value that arrives on
// its own, not an upsell. getEntitlements grants this to every account (Free too),
// so market checks always pass and only the docket-limit / AI-quota gate.
export const ALL_MARKETS = ["PUCT", "ERCOT", "CAISO", "PJM"] as const

// Free is a real tier — the funnel door. It's the default entitlement set for any
// account with no paid subscription (getEntitlements falls back to it).
export const FREE_ENTITLEMENTS: EntitlementRow[] = [
  { feature: "daily_brief",      value: {} },
  { feature: "tracked_dockets",  value: { limit: 2 } },
  { feature: "ai_actions",       value: { per_month: 3 } },
  { feature: "saved_searches",   value: { limit: 1 } },
  { feature: "brief_history",    value: { days: 30 } },
  { feature: "team_seats",       value: { limit: 1 } },
  { feature: "watched_entities", value: { limit: 3 } },
]

export const TIER_ENTITLEMENTS: Record<Tier, EntitlementRow[]> = {
  free: FREE_ENTITLEMENTS,
  pro: [
    { feature: "daily_brief",      value: {} },
    { feature: "tracked_dockets",  value: { limit: 15 } },
    { feature: "ai_actions",       value: { per_month: 200 } },
    { feature: "saved_searches",   value: { limit: 10 } },
    { feature: "brief_history",    value: { days: 365 } },
    { feature: "team_seats",       value: { limit: 1 } },
    { feature: "watched_entities", value: { limit: 15 } },
  ],
  team: [
    { feature: "daily_brief",      value: {} },
    { feature: "tracked_dockets",  value: { limit: 40 } },
    { feature: "ai_actions",       value: { per_month: 1000 } },
    { feature: "saved_searches",   value: { limit: 50 } },
    { feature: "brief_history",    value: { days: 1095 } },
    { feature: "team_seats",       value: { limit: 5 } },
    { feature: "watched_entities", value: { limit: 50 } },
    { feature: "sla",              value: { uptime: 0.995 } },
  ],
  org: [
    { feature: "daily_brief",      value: {} },
    { feature: "tracked_dockets",  value: { limit: null } },      // null = unlimited
    { feature: "ai_actions",       value: { per_month: null } },  // null = unlimited
    { feature: "saved_searches",   value: { limit: null } },
    { feature: "brief_history",    value: { days: null } },
    { feature: "team_seats",       value: { limit: 25 } },
    { feature: "watched_entities", value: { limit: null } },
    { feature: "sla",              value: { uptime: 0.999 } },
    { feature: "audit_export",     value: {} },
    { feature: "api_access",       value: {} },
  ],
}

// Stripe price IDs → tier. Free needs no Stripe (it's $0 / no subscription); Org is
// quote-only. Set STRIPE_PRICE_PRO / STRIPE_PRICE_TEAM once the products exist.
export function resolveTier(priceId: string): Tier | null {
  if (!priceId) return null
  const candidates: [string | undefined, Tier][] = [
    [process.env.STRIPE_PRICE_PRO,  "pro"],
    [process.env.STRIPE_PRICE_TEAM, "team"],
    [process.env.STRIPE_PRICE_ORG,  "org"],
  ]
  for (const [envVal, tier] of candidates) {
    if (envVal && envVal === priceId) return tier
  }
  return null
}

// ---------------------------------------------------------------------------
// Display data — consumed by /pricing; derived here so the two can't diverge.
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
  { tier: "free", name: "Free", price: "$0",     period: "",    highlight: false, contactOnly: false },
  { tier: "pro",  name: "Pro",  price: "$219",   period: "/mo", highlight: true,  contactOnly: false },
  { tier: "team", name: "Team", price: "$850",   period: "/mo", highlight: false, contactOnly: false },
  { tier: "org",  name: "Org",  price: "Custom", period: "",    highlight: false, contactOnly: true  },
]

export interface FeatureRow {
  label: string
  values: Record<Tier, string>
  note?: string
}

export const FEATURE_MATRIX: FeatureRow[] = [
  {
    label: "Markets",
    values: { free: "All included", pro: "All included", team: "All included", org: "All included" },
    note: "Every market — ERCOT, CAISO, PJM and more — is included on every plan. New markets arrive free.",
  },
  {
    label: "Tracked dockets",
    values: { free: "2", pro: "15", team: "40", org: "Unlimited" },
  },
  {
    label: "AI actions (Ask the Record + summaries)",
    values: { free: "3 / mo", pro: "200 / mo", team: "1,000 / mo", org: "Custom" },
  },
  {
    label: "Connector (Claude / ChatGPT)",
    values: { free: "✓", pro: "✓", team: "✓", org: "✓ priority" },
  },
  {
    label: "Daily brief",
    values: { free: "✓", pro: "✓", team: "✓", org: "✓" },
  },
  {
    label: "Watched entities",
    values: { free: "3", pro: "15", team: "50", org: "Unlimited" },
  },
  {
    label: "Saved searches",
    values: { free: "1", pro: "10", team: "50", org: "Unlimited" },
  },
  {
    label: "Brief history",
    values: { free: "30 days", pro: "1 year", team: "3 years", org: "Unlimited" },
  },
  {
    label: "Team seats",
    values: { free: "1", pro: "1", team: "5", org: "25+" },
  },
  {
    label: "Audit export",
    values: { free: "—", pro: "—", team: "—", org: "✓" },
  },
  {
    label: "API + branded platform",
    values: { free: "—", pro: "—", team: "—", org: "✓" },
  },
  {
    label: "SLA",
    values: { free: "—", pro: "—", team: "99.5%", org: "99.9%" },
  },
]
