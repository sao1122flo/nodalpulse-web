import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockSelect, mockGetObject, mockNotFound } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
  mockGetObject: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND") }),
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
  notFound: mockNotFound,
}))

vi.mock("@/db/client", () => ({
  db: { select: mockSelect },
}))

vi.mock("@/db/schema", () => ({
  briefs: {
    id: "id", userId: "user_id", date: "date", model: "model",
    promptVer: "prompt_ver", htmlR2Key: "html_r2_key", citationCount: "citation_count",
    sendStatus: "send_status", sentAt: "sent_at",
  },
}))

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  and: (...args: unknown[]) => args,
}))

vi.mock("@/lib/r2", () => ({
  getObject: mockGetObject,
}))

vi.mock("@/app/(app)/dashboard/BriefFrame", () => ({ default: () => null }))
vi.mock("@/app/(app)/dashboard/ReloadButton", () => ({ ReloadButton: () => null }))
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }))

function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "limit"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

const BRIEF_ROW = {
  id: "brief-abc",
  date: "2026-05-13",
  model: "claude-opus-4-7",
  promptVer: "v3",
  htmlR2Key: "briefs/user-1/2026-05-13/brief.html",
  citationCount: 5,
  sendStatus: "sent",
  sentAt: new Date("2026-05-13T11:00:00Z"),
}

import BriefDetailPage from "../page"

describe("BriefDetailPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders brief HTML when R2 returns content", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([BRIEF_ROW]))
    mockGetObject.mockResolvedValue("<html>brief content</html>")

    const result = await BriefDetailPage({ params: Promise.resolve({ id: "brief-abc" }) })
    expect(result).toBeDefined()
    expect(mockGetObject).toHaveBeenCalledWith(BRIEF_ROW.htmlR2Key)
  })

  it("renders not-found on wrong user (brief row absent for this user_id)", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "other-user", email: "other@test.com" } })
    // Query scoped to session user returns empty — simulates the WHERE user_id guard
    mockSelect.mockReturnValue(makeChain([]))

    await expect(
      BriefDetailPage({ params: Promise.resolve({ id: "brief-abc" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")

    expect(mockNotFound).toHaveBeenCalledOnce()
  })

  it("renders fallback when R2 fetch throws", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([BRIEF_ROW]))
    mockGetObject.mockRejectedValue(new Error("S3 error"))

    const result = await BriefDetailPage({ params: Promise.resolve({ id: "brief-abc" }) })
    expect(result).toBeDefined()
  })
})
