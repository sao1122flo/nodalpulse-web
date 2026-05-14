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
  briefs: {
    id: "id", userId: "user_id", date: "date", citationCount: "citation_count",
    sendStatus: "send_status", sentAt: "sent_at",
  },
}))

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  desc: (a: unknown) => ({ desc: a }),
}))

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}))

function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "orderBy"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

import BriefsPage from "../page"

describe("BriefsPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when no session exists", async () => {
    mockGetSession.mockResolvedValue(null)

    await expect(BriefsPage()).rejects.toThrow("NEXT_REDIRECT")
  })

  it("renders without throwing when briefs exist", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([
      {
        id: "brief-abc",
        date: "2026-05-13",
        citationCount: 7,
        sendStatus: "sent",
        sentAt: new Date("2026-05-13T11:00:00Z"),
      },
    ]))

    const result = await BriefsPage()
    expect(result).toBeDefined()
  })

  it("renders without throwing when no briefs exist (empty state)", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-2", email: "u2@test.com" } })
    mockSelect.mockReturnValue(makeChain([]))

    const result = await BriefsPage()
    expect(result).toBeDefined()
  })
})
