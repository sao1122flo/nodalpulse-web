import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockSelect, mockInsert, mockDelete, mockRevalidatePath, mockRefreshDocket } = vi.hoisted(() => ({
  mockGetSession:     vi.fn(),
  mockSelect:         vi.fn(),
  mockInsert:         vi.fn(),
  mockDelete:         vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRefreshDocket:  vi.fn().mockResolvedValue({ ok: true, value: { docket_number: "59475", queued: 0, already_extracted: 0 } }),
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock("@/db/client", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  },
}))

vi.mock("@/db/schema", () => ({
  userDockets: { userId: "user_id", docketId: "docket_id" },
  dockets:     { id: "id", sourceId: "source_id", externalId: "external_id", title: "title", status: "status" },
  filings:     { id: "id", title: "title", filedAt: "filed_at" },
  extractions: { id: "id", filingId: "filing_id", payload: "payload" },
}))

vi.mock("@/lib/services-client", () => ({
  refreshDocket: mockRefreshDocket,
}))

vi.mock("@/lib/entitlements", () => ({
  getEntitlements: vi.fn().mockResolvedValue({
    tier: "starter",
    trackedDockets: { limit: 5 },
    savedSearches:  { limit: 2 },
    dailyBrief: true,
    briefHistory: { days: 30 },
    qa: { limitPerDay: 0 },
    teamSeats: { limit: 1 },
    auditExport: false,
    apiAccess: false,
  }),
}))

vi.mock("drizzle-orm", () => ({
  eq:    (...args: unknown[]) => ({ eq: args }),
  and:   (...args: unknown[]) => args,
  desc:  (col: unknown) => ({ desc: col }),
  count: () => "count()",
  sql:   new Proxy((() => ({})) as unknown as typeof import("drizzle-orm").sql, {
    apply: () => ({}),
    get:   () => () => ({}),
  }),
}))

function makeSelectChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "innerJoin", "orderBy", "limit"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

function makeInsertChain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  for (const m of ["values", "onConflictDoNothing", "returning"]) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = Promise.resolve([{ id: "new-docket-uuid" }]).then.bind(Promise.resolve([{ id: "new-docket-uuid" }]))
  return chain
}

function makeDeleteChain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  chain.where = vi.fn().mockResolvedValue(undefined)
  return chain
}

import { trackDocket, untrackDocket } from "../actions"

describe("docket actions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("trackDocket returns error when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await trackDocket({ docketNumber: "59475" })
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe("Unauthenticated")
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("trackDocket creates docket row and user_dockets row, then revalidates paths", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    // 1st select: count existing userDockets (tier gate) → 0
    // 2nd select: docket lookup → not found
    // 3rd select: label lookup → no label
    // 4th select: re-fetch after insert → returns created row
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ ct: "0" }]))              // tier gate count
      .mockReturnValueOnce(makeSelectChain([]))                         // docket not found
      .mockReturnValueOnce(makeSelectChain([]))                         // no label filing
      .mockReturnValueOnce(makeSelectChain([{ id: "new-docket-uuid" }])) // re-fetch
    mockInsert.mockReturnValue(makeInsertChain())

    const result = await trackDocket({ docketNumber: "59475" })
    expect(result.ok).toBe(true)
    expect(mockInsert).toHaveBeenCalledTimes(2) // insert docket + insert user_dockets
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dockets")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dockets/59475")
  })

  it("untrackDocket deletes the user_dockets row and revalidates paths", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockSelect.mockReturnValue(makeSelectChain([{ id: "docket-uuid-1" }]))
    mockDelete.mockReturnValue(makeDeleteChain())

    const result = await untrackDocket({ docketNumber: "59475" })
    expect(result.ok).toBe(true)
    expect(mockDelete).toHaveBeenCalledOnce()
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dockets")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dockets/59475")
  })
})
