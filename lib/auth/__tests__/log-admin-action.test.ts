import { describe, it, expect, vi, beforeEach } from "vitest"
import { createHash } from "crypto"

const { mockGetSession, mockValues, mockInsert, adminActionsSymbol } = vi.hoisted(() => {
  const mockValues = vi.fn().mockResolvedValue([])
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues })
  return {
    mockGetSession: vi.fn(),
    mockValues,
    mockInsert,
    adminActionsSymbol: Symbol("admin_actions"),
  }
})

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("@/db/client", () => ({
  db: { insert: mockInsert },
}))

vi.mock("@/db/schema", () => ({
  adminActions: adminActionsSymbol,
}))

import { logAdminAction } from "../log-admin-action"

describe("logAdminAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("writes a SHA-256 hash of the email, never the raw email", async () => {
    const email = "admin@nodalpulse.com"
    mockGetSession.mockResolvedValue({ user: { email } })
    mockInsert.mockReturnValue({ values: mockValues })

    await logAdminAction({ action: "admin.viewed_index" })

    const row = mockValues.mock.calls[0][0] as Record<string, unknown>
    const expectedHash = createHash("sha256").update(email).digest("hex")

    expect(row.actorEmailHash).toBe(expectedHash)
    expect(String(row.actorEmailHash)).not.toContain("@")
    expect(row.actorEmailHash).not.toBe(email)
  })

  it("inserts into the adminActions table", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "admin@nodalpulse.com" } })
    mockInsert.mockReturnValue({ values: mockValues })

    await logAdminAction({ action: "admin.test" })

    expect(mockInsert).toHaveBeenCalledWith(adminActionsSymbol)
  })

  it("passes action, targetType, targetId, and metadata", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "admin@nodalpulse.com" } })
    mockInsert.mockReturnValue({ values: mockValues })

    await logAdminAction({
      action: "admin.grant_entitlement",
      targetType: "user",
      targetId: "abc-123",
      metadata: { feature: "daily-brief" },
    })

    const row = mockValues.mock.calls[0][0] as Record<string, unknown>
    expect(row.action).toBe("admin.grant_entitlement")
    expect(row.targetType).toBe("user")
    expect(row.targetId).toBe("abc-123")
    expect(row.metadata).toEqual({ feature: "daily-brief" })
  })

  it("falls back to 'unknown' email hash when there is no session", async () => {
    mockGetSession.mockResolvedValue(null)
    mockInsert.mockReturnValue({ values: mockValues })

    await logAdminAction({ action: "admin.test" })

    const row = mockValues.mock.calls[0][0] as Record<string, unknown>
    const expectedHash = createHash("sha256").update("unknown").digest("hex")
    expect(row.actorEmailHash).toBe(expectedHash)
  })
})
