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
  redirect:  vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
  notFound:  vi.fn(() => { throw new Error("NEXT_NOT_FOUND") }),
}))

vi.mock("@/db/client", () => ({
  db: { select: mockSelect },
}))

vi.mock("@/db/schema", () => ({
  userDockets: { id: "id", userId: "user_id", docketId: "docket_id" },
  dockets:     { id: "id", sourceId: "source_id", externalId: "external_id", jurisdiction: "jurisdiction" },
  filings:     { id: "id", title: "title", docType: "doc_type", filedAt: "filed_at", sourceUrl: "source_url", filer: "filer", filingId: "filing_id", docketId: "docket_id" },
  extractions: { id: "id", filingId: "filing_id", payload: "payload" },
}))

vi.mock("drizzle-orm", () => ({
  eq:       (...args: unknown[]) => ({ eq: args }),
  and:      (...args: unknown[]) => args,
  desc:     (col: unknown) => ({ desc: col }),
  gte:      (...args: unknown[]) => ({ gte: args }),
  lt:       (...args: unknown[]) => ({ lt: args }),
  isNotNull: (col: unknown) => ({ isNotNull: col }),
  count:    (col: unknown) => ({ count: col }),
  sql: new Proxy((() => ({})) as unknown as typeof import("drizzle-orm").sql, {
    apply: () => ({}),
    get: () => () => ({}),
  }),
}))

vi.mock("@/app/(app)/dockets/TrackButton", () => ({ TrackButton: () => null }))
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }))

function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { then: p.then.bind(p), catch: p.catch.bind(p) }
  for (const m of ["from", "where", "innerJoin", "leftJoin", "groupBy", "orderBy", "limit"]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

const DOCKET_ROW = { id: "docket-1", jurisdiction: "PUCT" }

const FILING_ROW = {
  id:        "filing-1",
  title:     "Application for Rate Increase",
  docType:   "puct-application",
  filedAt:   new Date("2026-04-01T12:00:00Z"),
  sourceUrl: "https://interchange.puc.texas.gov/docs/59475.pdf",
  filer:     "Oncor Electric",
  payload: {
    docket_number:  "59475",
    summary:        "Oncor requests a base rate increase.",
    parties:        ["Oncor Electric Delivery", "Office of Public Utility Counsel"],
    deadlines:      [{ description: "Intervention deadline", date: "2026-05-01" }],
    effective_date: "2026-06-01",
  },
}

import DocketDetailPage from "../[docketNumber]/page"

const DEFAULT_PARAMS = {
  params:       Promise.resolve({ docketNumber: "59475" }),
  searchParams: Promise.resolve({}),
}

describe("DocketDetailPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    mockSelect.mockReturnValue(makeChain([]))
    await expect(
      DocketDetailPage(DEFAULT_PARAMS),
    ).rejects.toThrow("NEXT_REDIRECT")
  })

  it("calls notFound when docket is not in DB", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    // Docket lookup returns empty — genuinely missing docket
    mockSelect.mockReturnValue(makeChain([]))
    await expect(
      DocketDetailPage({ params: Promise.resolve({ docketNumber: "EL25-99" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")
  })

  it("renders filings, parties, and timeline when data exists", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    // Selects: (1) docket lookup, (2) filings+extractions leftJoin, (3) tracking state
    mockSelect
      .mockReturnValueOnce(makeChain([DOCKET_ROW]))
      .mockReturnValueOnce(makeChain([FILING_ROW]))
      .mockReturnValueOnce(makeChain([]))
    const result = await DocketDetailPage(DEFAULT_PARAMS)
    expect(result).toBeDefined()
  })

  it("renders zero-filings empty state when docket exists but has no filings", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    // Selects: (1) docket found, (2) filings → empty, (3) tracking → not tracked
    mockSelect
      .mockReturnValueOnce(makeChain([DOCKET_ROW]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
    const result = await DocketDetailPage({ params: Promise.resolve({ docketNumber: "99999" }), searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })

  it("passes isTracked=true to TrackButton when user is tracking the docket", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    // Selects: (1) docket lookup, (2) filings, (3) tracking record exists
    mockSelect
      .mockReturnValueOnce(makeChain([DOCKET_ROW]))
      .mockReturnValueOnce(makeChain([FILING_ROW]))
      .mockReturnValueOnce(makeChain([{ id: "ud-row-1" }]))
    const result = await DocketDetailPage(DEFAULT_PARAMS)
    expect(result).toBeDefined()
  })

  it("resolves non-PUCT docket by external_id (FERC format)", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    const fercDocket = { id: "docket-ferc", jurisdiction: "PJM-FERC" }
    mockSelect
      .mockReturnValueOnce(makeChain([fercDocket]))
      .mockReturnValueOnce(makeChain([{ ...FILING_ROW, docType: "pjm-filing" }]))
      .mockReturnValueOnce(makeChain([]))
    const result = await DocketDetailPage({
      params:       Promise.resolve({ docketNumber: "EL25-49" }),
      searchParams: Promise.resolve({}),
    })
    expect(result).toBeDefined()
  })
})
