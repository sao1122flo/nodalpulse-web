import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockRequireAdmin,
  mockLogAdminAction,
  mockRefreshExtraction,
  mockSelect,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockLogAdminAction: vi.fn().mockResolvedValue(undefined),
  mockRefreshExtraction: vi.fn(),
  mockSelect: vi.fn(),
  mockCheckRateLimit: vi.fn().mockReturnValue({ ok: true }),
}))

vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: mockRequireAdmin }))
vi.mock("@/lib/auth/log-admin-action", () => ({ logAdminAction: mockLogAdminAction }))
vi.mock("@/lib/services-client", () => ({ refreshExtraction: mockRefreshExtraction }))
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

const VALID_UUID = "00000000-0000-0000-0000-000000000001"

import { triggerRefreshExtraction } from "../extractions/actions"

describe("triggerRefreshExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ ok: true, email: "admin@test.com" })
    mockCheckRateLimit.mockReturnValue({ ok: true })
  })

  it("valid UUID enqueues and returns the job result", async () => {
    mockSelect.mockReturnValue(makeChain([]))
    mockRefreshExtraction.mockResolvedValue({
      ok: true,
      value: { job_id: "job-ext-1", status: "queued" },
    })

    const result = await triggerRefreshExtraction(VALID_UUID)

    expect(result).toEqual({ ok: true, value: { jobId: "job-ext-1", status: "queued" } })
    expect(mockRefreshExtraction).toHaveBeenCalledOnce()
  })

  it("invalid UUID returns a validation error without calling services", async () => {
    const result = await triggerRefreshExtraction("not-a-uuid")

    expect(result).toEqual({ ok: false, error: "Invalid filing ID — must be a UUID." })
    expect(mockRefreshExtraction).not.toHaveBeenCalled()
    expect(mockRequireAdmin).not.toHaveBeenCalled()
  })

  it("audit log entry has target_type 'filing' and raw target_id", async () => {
    mockSelect.mockReturnValue(makeChain([]))
    mockRefreshExtraction.mockResolvedValue({
      ok: true,
      value: { job_id: "job-ext-2", status: "queued" },
    })

    await triggerRefreshExtraction(VALID_UUID)

    const call = mockLogAdminAction.mock.calls[0][0] as Record<string, unknown>
    expect(call.targetType).toBe("filing")
    expect(call.targetId).toBe(VALID_UUID)
    expect(call.action).toBe("admin.refreshed_extraction")
  })
})
