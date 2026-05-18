import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockDb } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDb: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("@/db/client", () => ({ db: mockDb }))

vi.mock("@/db/schema", () => ({
  userProfiles: { userId: "user_id", onboardingStep: "onboarding_step" },
  savedSearches: { userId: "user_id", id: "id" },
  userDockets:   { userId: "user_id" },
  briefs:        { userId: "user_id", date: "date" },
  jobs:          { id: "id", kind: "kind", status: "status", payload: "payload" },
}))

vi.mock("@/lib/entitlements", () => ({
  getEntitlements: vi.fn().mockResolvedValue({
    tier: "starter",
    dailyBrief: true,
    trackedDockets: { limit: 5 },
    savedSearches:  { limit: 2 },
    briefHistory:   { days: 30 },
    qa:             { limitPerDay: 0 },
    teamSeats:      { limit: 1 },
    auditExport:    false,
    apiAccess:      false,
  }),
}))

vi.mock("@/lib/services-client", () => ({
  recomposeBrief: vi.fn().mockResolvedValue({ ok: true, value: { job_id: "job-123", status: "queued" } }),
}))

vi.mock("drizzle-orm", () => ({
  eq:    vi.fn((a, b) => ({ eq: [a, b] })),
  and:   vi.fn((...args) => ({ and: args })),
  count: vi.fn(() => "count()"),
  sql:   vi.fn(() => "sql"),
}))

function makeChain(resolveWith: unknown = undefined) {
  const chain: Record<string, unknown> = {}
  const resolve = () => Promise.resolve(resolveWith)
  chain.values         = vi.fn(() => chain)
  chain.set            = vi.fn(() => chain)
  chain.where          = vi.fn(() => chain)
  chain.limit          = vi.fn(() => resolve())
  chain.onConflictDoUpdate   = vi.fn(() => resolve())
  chain.onConflictDoNothing  = vi.fn(() => chain)
  chain.returning      = vi.fn(() => resolve())
  chain.from           = vi.fn(() => chain)
  chain.orderBy        = vi.fn(() => resolve())
  return chain
}

import { saveRole, saveMarkets, advanceOnboarding, createSavedSearch, fireBrief } from "../actions"

describe("saveRole", () => {
  beforeEach(() => vi.clearAllMocks())

  it("throws Unauthenticated when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(saveRole("Regulatory Analyst")).rejects.toThrow("Unauthenticated")
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("upserts marketRoles for authenticated user", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-abc" } })
    const chain = makeChain()
    mockDb.insert.mockReturnValue(chain)

    await saveRole("Energy Lawyer")

    expect(mockDb.insert).toHaveBeenCalledOnce()
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-abc", marketRoles: ["Energy Lawyer"] }),
    )
  })
})

describe("saveMarkets", () => {
  beforeEach(() => vi.clearAllMocks())

  it("upserts trackedTags", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-xyz" } })
    const chain = makeChain()
    mockDb.insert.mockReturnValue(chain)

    await saveMarkets(["north", "houston"])

    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-xyz", trackedTags: ["north", "houston"] }),
    )
  })
})

describe("advanceOnboarding", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls update with GREATEST expression", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } })
    const chain = makeChain()
    mockDb.update.mockReturnValue(chain)

    await advanceOnboarding(3)

    expect(mockDb.update).toHaveBeenCalledOnce()
    expect(chain.set).toHaveBeenCalledOnce()
    expect(chain.where).toHaveBeenCalledOnce()
  })
})

describe("createSavedSearch", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(createSavedSearch("test", {})).rejects.toThrow("Unauthenticated")
  })

  it("rejects when limit is 0 (free user)", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } })
    const { getEntitlements } = await import("@/lib/entitlements")
    vi.mocked(getEntitlements).mockResolvedValueOnce({
      tier: null, dailyBrief: false, trackedDockets: { limit: 0 }, savedSearches: { limit: 0 },
      briefHistory: { days: 0 }, qa: { limitPerDay: 0 }, teamSeats: { limit: 0 },
      auditExport: false, apiAccess: false,
    })

    const result = await createSavedSearch("my search", {})
    expect(result).toEqual({ ok: false, error: expect.stringContaining("paid plan") })
  })

  it("rejects when at limit", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } })
    // entitlements mock returns limit: 2, simulate 2 existing
    const countChain = { from: vi.fn(), where: vi.fn(), select: vi.fn() }
    countChain.from = vi.fn(() => countChain)
    countChain.where = vi.fn(() => Promise.resolve([{ ct: "2" }]))
    mockDb.select.mockReturnValue(countChain)

    const result = await createSavedSearch("third search", {})
    expect(result).toEqual({ ok: false, error: expect.stringContaining("limit") })
  })
})

describe("fireBrief", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns jobId on success", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } })

    const result = await fireBrief()
    expect(result).toEqual({ ok: true, value: { jobId: "job-123" } })
  })

  it("returns error when recomposeBrief fails", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } })
    const { recomposeBrief } = await import("@/lib/services-client")
    vi.mocked(recomposeBrief).mockResolvedValueOnce({
      ok: false,
      error: { kind: "network", message: "timeout" },
    })

    const result = await fireBrief()
    expect(result).toEqual({ ok: false, error: expect.stringContaining("Failed") })
  })
})
