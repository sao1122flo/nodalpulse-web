import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockRequireAdmin, mockForbidden, mockLimit } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockForbidden: vi.fn(() => { throw new Error("NEXT_FORBIDDEN") }),
  mockLimit: vi.fn().mockResolvedValue([]),
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
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({ limit: mockLimit }),
          }),
        }),
      }),
    }),
  },
}))

vi.mock("@/db/schema", () => ({
  adminActions: { actorEmailHash: "actor_email_hash", createdAt: "created_at" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
}))

import AdminIndexPage from "../page"

describe("/admin page", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls forbidden() and throws for a non-admin user", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Forbidden" })
    await expect(AdminIndexPage()).rejects.toThrow("NEXT_FORBIDDEN")
    expect(mockForbidden).toHaveBeenCalledOnce()
  })

  it("calls forbidden() and throws for an unauthenticated request", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthenticated" })
    await expect(AdminIndexPage()).rejects.toThrow("NEXT_FORBIDDEN")
    expect(mockForbidden).toHaveBeenCalledOnce()
  })

  it("renders (returns a value) for a valid admin without throwing", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, email: "admin@nodalpulse.com" })
    mockLimit.mockResolvedValue([])
    const result = await AdminIndexPage()
    expect(result).toBeDefined()
    expect(mockForbidden).not.toHaveBeenCalled()
  })
})
