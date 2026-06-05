export const ALL_MARKETS = ["PUCT", "ERCOT", "CAISO", "PJM"] as const
export type Market = (typeof ALL_MARKETS)[number]

export const ALL_TIERS = ["starter", "pro", "team", "org"] as const
export type TierOption = (typeof ALL_TIERS)[number]

// Default beta window end — change here or override with BETA_END_DATE env var (server-side only).
export const BETA_END_ISO = "2026-12-31"
