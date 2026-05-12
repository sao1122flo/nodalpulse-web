import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockRequireAdmin, mockForbidden, mockExecute } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockForbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN")
  }),
  mockExecute: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock("@/lib/auth/log-admin-action", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/navigation", () => ({
  forbidden: mockForbidden,
}))

vi.mock("@/db/client", () => ({
  db: { execute: mockExecute },
}))

vi.mock("drizzle-orm", () => ({
  sql: vi.fn().mockReturnValue({}),
}))

import AdminCostPage from "../cost/page"

describe("/admin/cost page", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls forbidden() and throws for a non-admin user", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Forbidden" })
    await expect(AdminCostPage()).rejects.toThrow("NEXT_FORBIDDEN")
    expect(mockForbidden).toHaveBeenCalledOnce()
  })

  it("calls forbidden() and throws for an unauthenticated request", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthenticated" })
    await expect(AdminCostPage()).rejects.toThrow("NEXT_FORBIDDEN")
    expect(mockForbidden).toHaveBeenCalledOnce()
  })

  it("renders (returns a value) for a valid admin without throwing", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, email: "admin@nodalpulse.com" })
    mockExecute.mockResolvedValue([])
    const result = await AdminCostPage()
    expect(result).toBeDefined()
    expect(mockForbidden).not.toHaveBeenCalled()
  })
})
