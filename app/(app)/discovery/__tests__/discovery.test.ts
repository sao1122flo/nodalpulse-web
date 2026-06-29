import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockGetEntitlements, mockGetDiscoveryHits, q } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetEntitlements: vi.fn(),
  mockGetDiscoveryHits: vi.fn(),
  q: {
    getThemes:               vi.fn(),
    getWatchedThemeKeys:     vi.fn(),
    getDiscoveryThemeFeed:   vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
}))
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/entitlements", () => ({ getEntitlements: mockGetEntitlements }))
vi.mock("@/app/(app)/dashboard/queries", () => ({ getDiscoveryHits: mockGetDiscoveryHits }))
vi.mock("@/app/(app)/dashboard/components/DiscoveryPanel", () => ({ DiscoveryPanel: () => null }))
vi.mock("../queries", () => q)
vi.mock("../DiscoveryClient", () => ({ DiscoveryClient: () => null }))

import DiscoveryPage from "../page"

describe("DiscoveryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockGetEntitlements.mockResolvedValue({ marketAccess: ["PUCT"] })
    q.getThemes.mockResolvedValue([{ key: "roe", label: "ROE", definition: "x" }])
    q.getWatchedThemeKeys.mockResolvedValue(["roe"])
    q.getDiscoveryThemeFeed.mockResolvedValue([])
    mockGetDiscoveryHits.mockResolvedValue({ hits: [], hasEntities: false })
  })

  it("redirects to /login when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(DiscoveryPage()).rejects.toThrow("NEXT_REDIRECT")
  })

  it("shows the paid gate (no feed query) when the user has no market access", async () => {
    mockGetEntitlements.mockResolvedValue({ marketAccess: [] })
    const result = await DiscoveryPage()
    expect(result).toBeDefined()
    expect(q.getDiscoveryThemeFeed).not.toHaveBeenCalled()
  })

  it("renders the feed for any paid user (not gated behind CAISO/PJM)", async () => {
    // PUCT-only user (base ICP) must reach Discovery.
    const result = await DiscoveryPage()
    expect(result).toBeDefined()
    expect(q.getDiscoveryThemeFeed).toHaveBeenCalledWith("user-1", ["roe"], 30)
  })
})
