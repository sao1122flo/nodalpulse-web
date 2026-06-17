import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any imports that touch the DB or schema
// ---------------------------------------------------------------------------
const { mockDelete, mockInsert } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock("@/db/client", () => ({
  db: { delete: mockDelete, insert: mockInsert },
}))

vi.mock("@/db/schema", () => ({
  entitlements: { userId: "user_id", feature: "feature", value: "value", expiresAt: "expires_at", source: "source" },
}))

vi.mock("drizzle-orm", () => ({
  eq:      vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  and:     vi.fn((...args: unknown[]) => ({ op: "and", args })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
}))

import { resolveTier, resolveAddonMarket, TIER_ENTITLEMENTS, type Tier } from "@/lib/tiers"
import { applyTierEntitlements } from "@/lib/entitlements"

// ---------------------------------------------------------------------------
// resolveTier
// ---------------------------------------------------------------------------
describe("resolveTier", () => {
  const PRICE_IDS = {
    starter: "price_starter_test",
    pro:     "price_pro_test",
    team:    "price_team_test",
    org:     "price_org_test",
  }

  beforeEach(() => {
    process.env.STRIPE_PRICE_STARTER = PRICE_IDS.starter
    process.env.STRIPE_PRICE_PRO     = PRICE_IDS.pro
    process.env.STRIPE_PRICE_TEAM    = PRICE_IDS.team
    process.env.STRIPE_PRICE_ORG     = PRICE_IDS.org
  })

  afterEach(() => {
    delete process.env.STRIPE_PRICE_STARTER
    delete process.env.STRIPE_PRICE_PRO
    delete process.env.STRIPE_PRICE_TEAM
    delete process.env.STRIPE_PRICE_ORG
  })

  it.each([
    ["price_starter_test", "starter"],
    ["price_pro_test",     "pro"],
    ["price_team_test",    "team"],
    ["price_org_test",     "org"],
  ] as [string, Tier][])("resolves %s to '%s'", (priceId, expected) => {
    expect(resolveTier(priceId)).toBe(expected)
  })

  it("returns null for an unknown price ID", () => {
    expect(resolveTier("price_unknown_xyz")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(resolveTier("")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveAddonMarket
// ---------------------------------------------------------------------------
describe("resolveAddonMarket", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_ADDON_CAISO = "price_addon_caiso_test"
  })

  afterEach(() => {
    delete process.env.STRIPE_PRICE_ADDON_CAISO
  })

  it("resolves CAISO add-on price to 'CAISO'", () => {
    expect(resolveAddonMarket("price_addon_caiso_test")).toBe("CAISO")
  })

  it("returns null for an unknown add-on price", () => {
    expect(resolveAddonMarket("price_unknown")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(resolveAddonMarket("")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// TIER_ENTITLEMENTS shape validation
// ---------------------------------------------------------------------------
describe("TIER_ENTITLEMENTS", () => {
  const ALL_TIERS: Tier[] = ["starter", "pro", "team", "org"]

  it("has entries for every tier", () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_ENTITLEMENTS[tier]).toBeDefined()
      expect(TIER_ENTITLEMENTS[tier].length).toBeGreaterThan(0)
    }
  })

  it("every tier includes daily_brief", () => {
    for (const tier of ALL_TIERS) {
      const features = TIER_ENTITLEMENTS[tier].map(e => e.feature)
      expect(features).toContain("daily_brief")
    }
  })

  it("starter has correct tracked_dockets limit", () => {
    const row = TIER_ENTITLEMENTS.starter.find(e => e.feature === "tracked_dockets")
    expect(row?.value).toEqual({ limit: 5 })
  })

  it("pro has correct qa limit_per_day", () => {
    const row = TIER_ENTITLEMENTS.pro.find(e => e.feature === "qa")
    expect(row?.value).toEqual({ limit_per_day: 30 })
  })

  it("team has sla with correct uptime", () => {
    const row = TIER_ENTITLEMENTS.team.find(e => e.feature === "sla")
    expect(row?.value).toEqual({ uptime: 0.995 })
  })

  it("org has unlimited dockets (null limit)", () => {
    const row = TIER_ENTITLEMENTS.org.find(e => e.feature === "tracked_dockets")
    expect(row?.value).toEqual({ limit: null })
  })

  it("org includes audit_export and api_access", () => {
    const features = TIER_ENTITLEMENTS.org.map(e => e.feature)
    expect(features).toContain("audit_export")
    expect(features).toContain("api_access")
  })

  it("starter and pro have team_seats limit 1", () => {
    for (const tier of ["starter", "pro"] as Tier[]) {
      const row = TIER_ENTITLEMENTS[tier].find(e => e.feature === "team_seats")
      expect(row?.value).toEqual({ limit: 1 })
    }
  })

  it("every tier includes qa entitlement", () => {
    for (const tier of ALL_TIERS) {
      const features = TIER_ENTITLEMENTS[tier].map(e => e.feature)
      expect(features).toContain("qa")
    }
  })

  it("org always includes all market_access rows regardless of BETA_MARKETS_FREE", () => {
    const features = TIER_ENTITLEMENTS.org.map(e => e.feature)
    expect(features).toContain("market_access:PUCT")
    expect(features).toContain("market_access:ERCOT")
    expect(features).toContain("market_access:CAISO")
    expect(features).toContain("market_access:PJM")
  })
})

// ---------------------------------------------------------------------------
// applyTierEntitlements — verifies DB calls per tier
// The function now deletes only source IN ('tier','addon') rows (not all rows)
// and inserts rows with source='tier' stamped.
// ---------------------------------------------------------------------------
describe("applyTierEntitlements", () => {
  function makeDeleteChain() {
    const chain: Record<string, unknown> = {}
    chain.where = vi.fn(() => Promise.resolve())
    return chain
  }
  function makeInsertChain() {
    const chain: Record<string, unknown> = {}
    chain.values = vi.fn(() => Promise.resolve())
    return chain
  }

  beforeEach(() => {
    process.env.STRIPE_PRICE_STARTER = "price_starter_test"
    process.env.STRIPE_PRICE_PRO     = "price_pro_test"
    process.env.STRIPE_PRICE_TEAM    = "price_team_test"
    process.env.STRIPE_PRICE_ORG     = "price_org_test"
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.STRIPE_PRICE_STARTER
    delete process.env.STRIPE_PRICE_PRO
    delete process.env.STRIPE_PRICE_TEAM
    delete process.env.STRIPE_PRICE_ORG
  })

  it("deletes source='tier'+'addon' rows and inserts tier rows with source='tier'", async () => {
    const deleteChain = makeDeleteChain()
    const insertChain = makeInsertChain()
    mockDelete.mockReturnValue(deleteChain)
    mockInsert.mockReturnValue(insertChain)

    await applyTierEntitlements("user-123", "price_pro_test", null)

    // Delete is called once (on entitlements table)
    expect(mockDelete).toHaveBeenCalledOnce()
    expect(deleteChain.where).toHaveBeenCalledOnce()

    // Insert is called once
    expect(mockInsert).toHaveBeenCalledOnce()
    const insertedRows = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0][0]

    // Every inserted row carries source='tier'
    for (const row of insertedRows) {
      expect(row.source).toBe("tier")
      expect(row.userId).toBe("user-123")
      expect(row.expiresAt).toBeNull()
    }

    const features = insertedRows.map((r: { feature: string }) => r.feature)
    expect(features).toContain("daily_brief")
    expect(features).toContain("tracked_dockets")
    // Features must match TIER_ENTITLEMENTS[pro]
    expect(features).toEqual(TIER_ENTITLEMENTS.pro.map(e => e.feature))
  })

  it("throws for an unrecognised price ID", async () => {
    await expect(
      applyTierEntitlements("user-123", "price_unknown", null)
    ).rejects.toThrow("Unknown price ID: price_unknown")

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("passes expiresAt to all inserted rows", async () => {
    const deleteChain = makeDeleteChain()
    const insertChain = makeInsertChain()
    mockDelete.mockReturnValue(deleteChain)
    mockInsert.mockReturnValue(insertChain)

    const expiry = new Date("2026-06-01T00:00:00Z")
    await applyTierEntitlements("user-abc", "price_pro_test", expiry)

    const insertedRows = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0][0]
    for (const row of insertedRows) {
      expect(row.expiresAt).toBe(expiry)
    }
  })

  it("inserts the correct feature set for each tier", async () => {
    for (const [priceEnvKey, tier] of [
      ["price_starter_test", "starter"],
      ["price_pro_test",     "pro"],
      ["price_team_test",    "team"],
      ["price_org_test",     "org"],
    ] as [string, Tier][]) {
      const deleteChain = makeDeleteChain()
      const insertChain = makeInsertChain()
      mockDelete.mockReturnValue(deleteChain)
      mockInsert.mockReturnValue(insertChain)

      await applyTierEntitlements("user-x", priceEnvKey, null)

      const insertedRows = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const features = insertedRows.map((r: { feature: string }) => r.feature)
      expect(features).toEqual(TIER_ENTITLEMENTS[tier].map(e => e.feature))

      vi.clearAllMocks()
    }
  })
})
