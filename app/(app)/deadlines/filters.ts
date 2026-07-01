// Shared filter + grouping logic for the Deadlines surface (B2).
// Pure, client-safe — must NOT import from dashboard/queries.ts (that pulls in
// the server-only `db` client and would break the client bundle). The
// jurisdiction→market map is duplicated here on purpose for that reason.

// ---------------------------------------------------------------------------
// Market filtering
// ---------------------------------------------------------------------------

// dockets.jurisdiction → display market. Mirrors JURISDICTION_TO_MARKET in
// dashboard/queries.ts; kept local so this module stays client-safe.
const JURISDICTION_TO_MARKET: Record<string, string> = {
  PUCT:         "PUCT",
  ERCOT:        "ERCOT",
  "CAISO-FERC": "CAISO",
  CAISO:        "CAISO",
  CPUC:         "CAISO",
  "PJM-FERC":   "PJM",
  PJM:          "PJM",
  "NJ-BPU":     "PJM",
  "MD-PSC":     "PJM",
  "VA-SCC":     "PJM",
  FERC:         "FERC",
}

export interface MarketChip {
  key:     string
  label:   string
  markets: string[]   // display-market codes this chip matches
}

// UI chip groups — Texas folds PUCT+ERCOT (display only). FERC is its own chip.
export const MARKET_CHIPS: MarketChip[] = [
  { key: "texas",      label: "Texas",      markets: ["PUCT", "ERCOT"] },
  { key: "california", label: "California", markets: ["CAISO"] },
  { key: "pjm",        label: "PJM",        markets: ["PJM"] },
  { key: "ferc",       label: "FERC",       markets: ["FERC"] },
]

export function marketOf(jurisdiction: string | null): string | null {
  if (!jurisdiction) return null
  return JURISDICTION_TO_MARKET[jurisdiction] ?? null
}

export function matchesMarket(jurisdiction: string | null, chipKey: string | null): boolean {
  if (!chipKey || chipKey === "all") return true
  const chip = MARKET_CHIPS.find(c => c.key === chipKey)
  if (!chip) return true
  const m = marketOf(jurisdiction)
  return m !== null && chip.markets.includes(m)
}

// Which market chips to render for a user, from their entitlement market codes
// (PUCT/ERCOT/CAISO/PJM). FERC dockets surface for CAISO/PJM subscribers, so the
// FERC chip appears when either is held. Pure → safe to call from the server.
export function entitledMarketChips(marketAccess: string[]): MarketChip[] {
  const set = new Set(marketAccess)
  return MARKET_CHIPS.filter(chip => {
    if (chip.key === "ferc") return set.has("CAISO") || set.has("PJM")
    return chip.markets.some(m => set.has(m))
  })
}

// ---------------------------------------------------------------------------
// Type filtering (D4)
// Explicit chips map to payload `type` values; "other" is the catch-all
// complement so no type value is ever unfilterable.
// ---------------------------------------------------------------------------

export type TypeFilter = "all" | "hearing" | "comment" | "compliance" | "effective" | "other"

const TYPE_CHIP_MATCH: Record<Exclude<TypeFilter, "all" | "other">, string[]> = {
  hearing:    ["hearing"],
  comment:    ["comment_deadline", "protest_notice"],
  compliance: ["compliance"],
  effective:  ["effective_date", "order_effective"],
}

// Every type value claimed by a non-"other" chip — "other" matches the rest.
const CLAIMED_TYPES = new Set(Object.values(TYPE_CHIP_MATCH).flat())

export const TYPE_CHIPS: { key: TypeFilter; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "hearing",    label: "Hearing" },
  { key: "comment",    label: "Comment & Protest" },
  { key: "compliance", label: "Compliance" },
  { key: "effective",  label: "Effective date" },
  { key: "other",      label: "Other" },
]

export function matchesType(type: string, filter: TypeFilter): boolean {
  if (filter === "all") return true
  if (filter === "other") return !CLAIMED_TYPES.has(type)
  return TYPE_CHIP_MATCH[filter].includes(type)
}

// ---------------------------------------------------------------------------
// Urgency buckets + colors (spec thresholds: ≤7 danger, ≤30 warning, else neutral)
// ---------------------------------------------------------------------------

export type UrgencyBucket = "thisWeek" | "next30" | "later"

export const BUCKET_ORDER: UrgencyBucket[] = ["thisWeek", "next30", "later"]

export const BUCKET_LABEL: Record<UrgencyBucket, string> = {
  thisWeek: "This week",
  next30:   "Next 30 days",
  later:    "Later",
}

export function urgencyBucket(daysRemaining: number): UrgencyBucket {
  if (daysRemaining <= 7)  return "thisWeek"
  if (daysRemaining <= 30) return "next30"
  return "later"
}

export function urgencyText(days: number): string {
  if (days <= 7)  return "text-[var(--np-danger)]"
  if (days <= 30) return "text-[var(--np-deadline)]"
  return "text-[var(--np-text-muted)]"
}

export function urgencyBg(days: number): string {
  if (days <= 7)  return "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)]"
  if (days <= 30) return "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.06)]"
  return "border-[var(--np-border)] bg-[var(--np-surface-elevated)]"
}
