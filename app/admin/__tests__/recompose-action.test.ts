import { describe, it, expect, vi, beforeEach } from "vitest"
import { createHash } from "crypto"

const { mockRequireAdmin, mockLogAdminAction, mockRecomposeBrief, mockSelect, mockCheckRateLimit } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockLogAdminAction: vi.fn().mockResolvedValue(undefined),
    mockRecomposeBrief: vi.fn(),
    mockSelect: vi.fn(),
    mockCheckRateLimit: vi.fn().mockReturnValue({ ok: true }),
  }))

vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: mockRequireAdmin }))
vi.mock("@/lib/auth/log-admin-action", () => ({ logAdminAction: mockLogAdminAction }))
vi.mock("@/lib/services-client", () => ({ recomposeBrief: mockRecomposeBrief }))
vi.mock("@/db/client", () => ({ db: { select: mockSelect } }))
vi.mock("@/db/schema", () => ({
  adminActions: {
    actorEmailHash: "actorEmailHash",
    action: "action",
    targetId: "targetId",
    createdAt: "createdAt",
    metadata: "metadata",
  },
  jobs: { id: "id", status: "status", error: "error" },
}))
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  gte: (a: unknown, b: unknown) => ({ gte: [a, b] }),
}))
vi.mock("@/lib/admin/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "orderBy", "limit"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

import { triggerRecompose, pollJobStatus } from "../users/actions"

describe("triggerRecompose", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ ok: true, email: "admin@test.com" })
    mockCheckRateLimit.mockReturnValue({ ok: true })
  })

  it("calls recomposeBrief and returns the job result", async () => {
    mockSelect.mockReturnValue(makeChain([]))
    mockRecomposeBrief.mockResolvedValue({
      ok: true,
      value: { job_id: "job-abc", status: "queued" },
    })

    const result = await triggerRecompose({ userId: "user-123", briefDate: "2026-05-12" })

    expect(result).toEqual({ ok: true, value: { jobId: "job-abc", status: "queued" } })
    expect(mockRecomposeBrief).toHaveBeenCalledOnce()
  })

  it("propagates a services 401 as an error result", async () => {
    mockSelect.mockReturnValue(makeChain([]))
    mockRecomposeBrief.mockResolvedValue({ ok: false, error: { kind: "unauthorized" } })

    const result = await triggerRecompose({ userId: "user-123", briefDate: "2026-05-12" })

    expect(result).toEqual({ ok: false, error: "Services error: unauthorized" })
  })

  it("returns cached jobId when a dedup row exists within 5 s", async () => {
    mockSelect.mockReturnValue(makeChain([{ metadata: { jobId: "cached-job" } }]))

    const result = await triggerRecompose({ userId: "user-123", briefDate: "2026-05-12" })

    expect(result).toEqual({ ok: true, value: { jobId: "cached-job", status: "already_queued" } })
    expect(mockRecomposeBrief).not.toHaveBeenCalled()
  })

  it("passes raw targetId (not hashed) to logAdminAction", async () => {
    mockSelect.mockReturnValue(makeChain([]))
    mockRecomposeBrief.mockResolvedValue({
      ok: true,
      value: { job_id: "job-xyz", status: "queued" },
    })

    await triggerRecompose({ userId: "user-999", briefDate: "2026-05-12" })

    const call = mockLogAdminAction.mock.calls[0][0] as Record<string, unknown>
    expect(call.targetId).toBe("user-999")
    expect(call.targetId).not.toBe(createHash("sha256").update("user-999").digest("hex"))
  })
})

describe("checkRateLimit", () => {
  it("allows 10 calls then blocks the 11th", async () => {
    const { checkRateLimit } = await vi.importActual<
      typeof import("@/lib/admin/rate-limit")
    >("@/lib/admin/rate-limit")
    const email = `ratelimit-${Date.now()}@test.com`
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(email)).toEqual({ ok: true })
    }
    const result = checkRateLimit(email)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.retryAfterMs).toBeGreaterThan(0)
    }
  })
})

describe("pollJobStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ ok: true, email: "admin@test.com" })
  })

  it("returns done status when the job has completed", async () => {
    mockSelect.mockReturnValue(makeChain([{ status: "done", error: null }]))

    const result = await pollJobStatus("job-done-id")

    expect(result).toEqual({ ok: true, value: { status: "done", error: null } })
  })
})
