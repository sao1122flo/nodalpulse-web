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
  entitlements: { userId: "user_id", feature: "feature", value: "value", expiresAt: "expires_at" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}))

import { resolveTier, TIER_ENTITLEMENTS, type Tier } from "@/lib/tiers"
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

  it("starter does not have qa entitlement", () => {
    const features = TIER_ENTITLEMENTS.starter.map(e => e.feature)
    expect(features).not.toContain("qa")
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

  it.each([
    ["price_starter_test", "starter", 5]  as [string, Tier, number],
    ["price_pro_test",     "pro",     6]  as [string, Tier, number],
    ["price_team_test",    "team",    7]  as [string, Tier, number],
    ["price_org_test",     "org",     9]  as [string, Tier, number],
  ])("inserts correct entitlement count for %s (%s tier)", async (priceId, tier, expectedCount) => {
    const deleteChain = makeDeleteChain()
    const insertChain = makeInsertChain()
    mockDelete.mockReturnValue(deleteChain)
    mockInsert.mockReturnValue(insertChain)

    await applyTierEntitlements("user-123", priceId, null)

    expect(mockDelete).toHaveBeenCalledOnce()
    expect(deleteChain.where).toHaveBeenCalledOnce()

    expect(mockInsert).toHaveBeenCalledOnce()
    const insertedRows = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertedRows).toHaveLength(expectedCount)
    expect(insertedRows[0]).toMatchObject({ userId: "user-123", expiresAt: null })

    const features = insertedRows.map((r: { feature: string }) => r.feature)
    expect(features).toContain("daily_brief")
    expect(features).toContain("tracked_dockets")
    expect(TIER_ENTITLEMENTS[tier].map(e => e.feature)).toEqual(features)
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
})
