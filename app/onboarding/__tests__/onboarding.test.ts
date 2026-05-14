import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockInsert } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("@/db/client", () => ({
  db: { insert: mockInsert },
}))

vi.mock("@/db/schema", () => ({
  userProfiles: { userId: "user_id" },
}))

vi.mock("drizzle-orm/pg-core", () => ({}))

function makeInsertChain() {
  const chain: Record<string, unknown> = {}
  chain.values = vi.fn(() => chain)
  chain.onConflictDoUpdate = vi.fn(() => Promise.resolve())
  return chain
}

import { saveProfile } from "../actions"

describe("saveProfile", () => {
  beforeEach(() => vi.clearAllMocks())

  it("throws Unauthenticated when no session exists", async () => {
    mockGetSession.mockResolvedValue(null)

    await expect(
      saveProfile({ role: "Regulatory Analyst", markets: ["all"], docketIds: [] }),
    ).rejects.toThrow("Unauthenticated")

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("persists role and markets for an authenticated user", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-abc" } })
    const chain = makeInsertChain()
    mockInsert.mockReturnValue(chain)

    await saveProfile({ role: "Energy Lawyer", markets: ["north", "houston"], docketIds: [] })

    expect(mockInsert).toHaveBeenCalledOnce()
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-abc",
        marketRoles: ["Energy Lawyer"],
        trackedTags: ["north", "houston"],
      }),
    )
  })

  it("accepts an empty docketIds array without error", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-xyz" } })
    const chain = makeInsertChain()
    mockInsert.mockReturnValue(chain)

    await expect(
      saveProfile({ role: "Trader / Risk Manager", markets: ["all"], docketIds: [] }),
    ).resolves.toBeUndefined()
  })
})
