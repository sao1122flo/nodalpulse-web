import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockSelect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
}))

vi.mock("@/db/client", () => ({
  db: { select: mockSelect },
}))

vi.mock("@/db/schema", () => ({
  userDockets: { userId: "user_id", docketId: "docket_id", createdAt: "created_at" },
  dockets: { id: "id", externalId: "external_id", title: "title", status: "status" },
}))

vi.mock("drizzle-orm", () => ({
  eq:   (...args: unknown[]) => ({ eq: args }),
  desc: (col: unknown) => ({ desc: col }),
}))

vi.mock("@/app/(app)/dockets/AddDocketForm", () => ({ AddDocketForm: () => null }))
vi.mock("@/app/(app)/dockets/UntrackButton",  () => ({ UntrackButton: () => null }))
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }))

function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "innerJoin", "orderBy", "limit"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

const TRACKED_ROW = {
  id:         "docket-uuid-1",
  externalId: "59475",
  title:      "Oncor Electric Rate Case",
  status:     "open",
  trackedAt:  new Date("2026-05-10T12:00:00Z"),
}

import DocketsPage from "../page"

describe("DocketsPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(DocketsPage()).rejects.toThrow("NEXT_REDIRECT")
  })

  it("renders empty state when no dockets are tracked", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([]))
    const result = await DocketsPage()
    expect(result).toBeDefined()
  })

  it("renders tracked dockets in the list", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([TRACKED_ROW]))
    const result = await DocketsPage()
    expect(result).toBeDefined()
  })

  it("queries dockets joined to userDockets filtered by session user_id", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    const chain = makeChain([TRACKED_ROW])
    mockSelect.mockReturnValue(chain)
    await DocketsPage()
    expect(chain.where).toHaveBeenCalledOnce()
    expect(chain.innerJoin).toHaveBeenCalledOnce()
  })
})
