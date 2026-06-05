export const ALL_MARKETS = ["PUCT", "ERCOT", "CAISO", "PJM"] as const
export type Market = (typeof ALL_MARKETS)[number]
