import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("@/lib/env", () => ({
  env: { ADMIN_EMAILS: ["admin@example.com"] },
}))

import { requireAdmin } from "../require-admin"

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthenticated when there is no session", async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await requireAdmin()).toEqual({ ok: false, error: "Unauthenticated" })
  })

  it("returns Forbidden for an authenticated non-admin email", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "user@example.com" } })
    expect(await requireAdmin()).toEqual({ ok: false, error: "Forbidden" })
  })

  it("returns Forbidden for a non-admin even when casing differs", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "User@Example.COM" } })
    expect(await requireAdmin()).toEqual({ ok: false, error: "Forbidden" })
  })

  it("returns ok:true for the configured admin email", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "admin@example.com" } })
    expect(await requireAdmin()).toEqual({ ok: true, email: "admin@example.com" })
  })

  it("is case-insensitive on admin email match", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "Admin@Example.COM" } })
    const result = await requireAdmin()
    expect(result.ok).toBe(true)
  })
})
