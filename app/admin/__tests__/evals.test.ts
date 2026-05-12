import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockRequireAdmin, mockForbidden, mockSelect } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockForbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN")
  }),
  mockSelect: vi.fn(),
}))

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock("next/navigation", () => ({
  forbidden: mockForbidden,
}))

vi.mock("@/db/client", () => ({
  db: { select: mockSelect },
}))

vi.mock("@/db/schema", () => ({
  evalRuns: { runAt: "run_at" },
}))

vi.mock("drizzle-orm", () => ({
  desc: vi.fn(),
}))

function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "orderBy", "limit"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

import AdminEvalsPage from "../evals/page"

describe("/admin/evals page", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls forbidden() and throws for a non-admin user", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Forbidden" })
    await expect(AdminEvalsPage()).rejects.toThrow("NEXT_FORBIDDEN")
    expect(mockForbidden).toHaveBeenCalledOnce()
  })

  it("calls forbidden() and throws for an unauthenticated request", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthenticated" })
    await expect(AdminEvalsPage()).rejects.toThrow("NEXT_FORBIDDEN")
    expect(mockForbidden).toHaveBeenCalledOnce()
  })

  it("renders (returns a value) for a valid admin without throwing", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, email: "admin@nodalpulse.com" })
    mockSelect.mockReturnValue(makeChain([]))
    const result = await AdminEvalsPage()
    expect(result).toBeDefined()
    expect(mockForbidden).not.toHaveBeenCalled()
  })
})
