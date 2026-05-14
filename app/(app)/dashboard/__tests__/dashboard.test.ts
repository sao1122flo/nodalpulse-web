import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockSelect, mockGetObject, mockRecomposeBrief } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
  mockGetObject: vi.fn(),
  mockRecomposeBrief: vi.fn(),
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
    id: "id", userId: "user_id", date: "date", model: "model",
    promptVer: "prompt_ver", htmlR2Key: "html_r2_key", citationCount: "citation_count",
    sendStatus: "send_status", sentAt: "sent_at",
  },
}))

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  and: (...args: unknown[]) => args,
  desc: (a: unknown) => ({ desc: a }),
}))

vi.mock("@/lib/r2", () => ({
  getObject: mockGetObject,
}))

vi.mock("@/lib/copy", () => ({
  BRIEF_DELIVERY_COPY: "Briefs are sent weekdays at 6:00 AM CT. Check your inbox then, or come back here.",
}))

vi.mock("@/lib/services-client", () => ({
  recomposeBrief: mockRecomposeBrief,
}))

// Silence React component imports (not rendering in node env)
vi.mock("./BriefFrame", () => ({ default: () => null }))
vi.mock("./ReloadButton", () => ({ ReloadButton: () => null }))
vi.mock("./RequestBriefButton", () => ({ RequestBriefButton: () => null }))
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }))

function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "orderBy", "limit"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

import DashboardPage from "../page"
import { requestBrief } from "../actions"

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when no session exists", async () => {
    mockGetSession.mockResolvedValue(null)

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT")
  })

  it("renders without throwing when a sent brief exists and R2 returns HTML", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([{
      id: "brief-1",
      date: "2026-05-13",
      model: "claude-opus-4-7",
      promptVer: "v3",
      htmlR2Key: "briefs/user-1/2026-05-13/brief.html",
      citationCount: 12,
      sendStatus: "sent",
      sentAt: new Date("2026-05-13T11:00:00Z"),
    }]))
    mockGetObject.mockResolvedValue("<html>brief</html>")

    const result = await DashboardPage()
    expect(result).toBeDefined()
  })
})

describe("requestBrief action", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns error for an unauthenticated request", async () => {
    mockGetSession.mockResolvedValue(null)

    const result = await requestBrief("2026-05-13")

    expect(result).toEqual({ ok: false, error: "Unauthenticated" })
    expect(mockRecomposeBrief).not.toHaveBeenCalled()
  })

  it("returns already_queued without calling services when a brief row exists for today", async () => {
    // This is the disabled-while-pending scenario: a brief is already in the DB
    // for today (pending send), so the button action short-circuits.
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([{ id: "existing-brief-id" }]))

    const result = await requestBrief("2026-05-13")

    expect(result).toEqual({
      ok: true,
      value: { jobId: "existing-brief-id", status: "already_queued" },
    })
    expect(mockRecomposeBrief).not.toHaveBeenCalled()
  })

  it("calls recomposeBrief and returns the job result when no brief exists yet", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeChain([]))
    mockRecomposeBrief.mockResolvedValue({
      ok: true,
      value: { job_id: "job-xyz", status: "queued" },
    })

    const result = await requestBrief("2026-05-13")

    expect(result).toEqual({ ok: true, value: { jobId: "job-xyz", status: "queued" } })
    expect(mockRecomposeBrief).toHaveBeenCalledOnce()
    expect(mockRecomposeBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        brief_date: "2026-05-13",
      }),
    )
  })
})
