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

import { resolveTier, TIER_ENTITLEMENTS, type Tier } from "@/lib/tiers"
import { applyTierEntitlements } from "@/lib/entitlements"

// ---------------------------------------------------------------------------
// resolveTier — Free needs no Stripe; paid tiers map from env price IDs.
// ---------------------------------------------------------------------------
describe("resolveTier", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO  = "price_pro_test"
    process.env.STRIPE_PRICE_TEAM = "price_team_test"
    process.env.STRIPE_PRICE_ORG  = "price_org_test"
  })
  afterEach(() => {
    delete process.env.STRIPE_PRICE_PRO
    delete process.env.STRIPE_PRICE_TEAM
    delete process.env.STRIPE_PRICE_ORG
  })

  it.each([
    ["price_pro_test",  "pro"],
    ["price_team_test", "team"],
    ["price_org_test",  "org"],
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
// TIER_ENTITLEMENTS shape — usage-gated model (markets never gate).
// ---------------------------------------------------------------------------
describe("TIER_ENTITLEMENTS", () => {
  const ALL_TIERS: Tier[] = ["free", "pro", "team", "org"]

  it("has entries for every tier including free", () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_ENTITLEMENTS[tier]).toBeDefined()
      expect(TIER_ENTITLEMENTS[tier].length).toBeGreaterThan(0)
    }
  })

  it("every tier carries an ai_actions monthly quota", () => {
    for (const tier of ALL_TIERS) {
      const row = TIER_ENTITLEMENTS[tier].find(e => e.feature === "ai_actions")
      expect(row, `${tier} missing ai_actions`).toBeDefined()
      expect(row?.value).toHaveProperty("per_month")
    }
  })

  it("free is a real tier: 2 dockets, 3 AI actions/mo", () => {
    const dockets = TIER_ENTITLEMENTS.free.find(e => e.feature === "tracked_dockets")
    const ai      = TIER_ENTITLEMENTS.free.find(e => e.feature === "ai_actions")
    expect(dockets?.value).toEqual({ limit: 2 })
    expect(ai?.value).toEqual({ per_month: 3 })
  })

  it("pro has 15 dockets and 200 AI actions/mo", () => {
    const dockets = TIER_ENTITLEMENTS.pro.find(e => e.feature === "tracked_dockets")
    const ai      = TIER_ENTITLEMENTS.pro.find(e => e.feature === "ai_actions")
    expect(dockets?.value).toEqual({ limit: 15 })
    expect(ai?.value).toEqual({ per_month: 200 })
  })

  it("org has unlimited dockets + AI (null) and audit_export + api_access", () => {
    const dockets = TIER_ENTITLEMENTS.org.find(e => e.feature === "tracked_dockets")
    const ai      = TIER_ENTITLEMENTS.org.find(e => e.feature === "ai_actions")
    expect(dockets?.value).toEqual({ limit: null })
    expect(ai?.value).toEqual({ per_month: null })
    const features = TIER_ENTITLEMENTS.org.map(e => e.feature)
    expect(features).toContain("audit_export")
    expect(features).toContain("api_access")
  })

  it("NO tier carries market_access rows — markets never gate", () => {
    for (const tier of ALL_TIERS) {
      const marketRows = TIER_ENTITLEMENTS[tier].filter(e => e.feature.startsWith("market_access:"))
      expect(marketRows, `${tier} should not gate markets`).toHaveLength(0)
    }
  })

  it("every tier carries a watched_entities cap", () => {
    for (const tier of ALL_TIERS) {
      const features = TIER_ENTITLEMENTS[tier].map(e => e.feature)
      expect(features).toContain("watched_entities")
    }
  })
})

// ---------------------------------------------------------------------------
// applyTierEntitlements — verifies DB calls per tier
// ---------------------------------------------------------------------------
describe("applyTierEntitlements", () => {
  function makeDeleteChain() {
    const chain: Record<string, unknown> = {}
    chain.where = vi.fn(() => Promise.resolve())
    return chain
  }
  function makeInsertChain() {
    const chain: Record<string, unknown> = {}
    chain.onConflictDoNothing = vi.fn(() => Promise.resolve())
    chain.values = vi.fn(() => chain)
    return chain
  }

  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO  = "price_pro_test"
    process.env.STRIPE_PRICE_TEAM = "price_team_test"
    process.env.STRIPE_PRICE_ORG  = "price_org_test"
    vi.clearAllMocks()
  })
  afterEach(() => {
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

    expect(mockDelete).toHaveBeenCalledOnce()
    expect(deleteChain.where).toHaveBeenCalledOnce()
    expect(mockInsert).toHaveBeenCalledOnce()

    const insertedRows = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0][0]
    for (const row of insertedRows) {
      expect(row.source).toBe("tier")
      expect(row.userId).toBe("user-123")
      expect(row.expiresAt).toBeNull()
    }
    const features = insertedRows.map((r: { feature: string }) => r.feature)
    expect(features).toEqual(TIER_ENTITLEMENTS.pro.map(e => e.feature))
  })

  it("throws for an unrecognised price ID", async () => {
    await expect(
      applyTierEntitlements("user-123", "price_unknown", null)
    ).rejects.toThrow("Unknown price ID: price_unknown")

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("inserts the correct feature set for each paid tier", async () => {
    for (const [priceEnvKey, tier] of [
      ["price_pro_test",  "pro"],
      ["price_team_test", "team"],
      ["price_org_test",  "org"],
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
