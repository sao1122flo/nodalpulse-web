import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetSession, mockGetEntitlements, mockGetQnaUsage, q } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetEntitlements: vi.fn(),
  mockGetQnaUsage: vi.fn(),
  q: {
    resolveDocket:        vi.fn(),
    getDocketMeta:        vi.fn(),
    getDocketFilingsPage: vi.fn(),
    getDocketParties:     vi.fn(),
    getDocketDeadlines:   vi.fn(),
    getLinkedDockets:     vi.fn(),
    getDocketSalience:    vi.fn(),
    isDocketTracked:      vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND") }),
}))
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }))

vi.mock("@/lib/entitlements", () => ({ getEntitlements: mockGetEntitlements }))
vi.mock("@/lib/services-client", () => ({ getQnaUsage: mockGetQnaUsage }))
vi.mock("../[docketNumber]/queries", () => q)

vi.mock("@/app/(app)/dashboard/queries", () => ({
  JURISDICTION_TO_MARKET: {
    PUCT: "PUCT", ERCOT: "ERCOT", "CAISO-FERC": "CAISO", CAISO: "CAISO",
    CPUC: "CAISO", "PJM-FERC": "PJM", PJM: "PJM", "NJ-BPU": "PJM", FERC: "FERC",
  },
}))
vi.mock("@/app/(app)/dashboard/components/JurisdictionBadge", () => ({
  JurisdictionBadge: () => null,
  jurisdictionLabel: (j: string) => j,
}))
vi.mock("@/app/(app)/dashboard/components/AskTheRecord", () => ({ AskTheRecord: () => null }))
vi.mock("@/app/(app)/dockets/TrackButton", () => ({ TrackButton: () => null }))
vi.mock("../[docketNumber]/KeyParties",      () => ({ KeyParties: () => null }))
vi.mock("../[docketNumber]/FilingTimeline",  () => ({ FilingTimeline: () => null }))
vi.mock("../[docketNumber]/RecordDeadlines", () => ({ RecordDeadlines: () => null }))

import DocketRecordPage from "../[docketNumber]/page"

const DOCKET = {
  id:           "docket-1",
  externalId:   "59475",
  title:        "Oncor base rate case",
  jurisdiction: "PUCT",
  status:       "open",
  openedAt:     "2026-01-01",
}

const META = { filingCount: 3, firstFiledAt: new Date("2026-01-02"), lastFiledAt: new Date("2026-04-01") }

const PARAMS = {
  params:       Promise.resolve({ docketNumber: "59475" }),
  searchParams: Promise.resolve({}),
}

function setHappyDefaults() {
  mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
  q.resolveDocket.mockResolvedValue(DOCKET)
  q.getDocketMeta.mockResolvedValue(META)
  mockGetEntitlements.mockResolvedValue({ marketAccess: ["PUCT"], qa: { limitPerDay: 30 } })
  q.isDocketTracked.mockResolvedValue(true)
  q.getDocketFilingsPage.mockResolvedValue([])
  q.getDocketParties.mockResolvedValue([])
  q.getDocketDeadlines.mockResolvedValue([])
  q.getLinkedDockets.mockResolvedValue([])
  q.getDocketSalience.mockResolvedValue(null)
  mockGetQnaUsage.mockResolvedValue({ ok: true, value: { used_today: 0 } })
}

describe("DocketRecordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHappyDefaults()
  })

  it("redirects to /login when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(DocketRecordPage(PARAMS)).rejects.toThrow("NEXT_REDIRECT")
  })

  it("calls notFound when the docket does not resolve", async () => {
    q.resolveDocket.mockResolvedValue(null)
    await expect(DocketRecordPage(PARAMS)).rejects.toThrow("NEXT_NOT_FOUND")
  })

  it("gates on market access and never reaches the tracked check", async () => {
    mockGetEntitlements.mockResolvedValue({ marketAccess: ["ERCOT"], qa: { limitPerDay: 30 } })
    const result = await DocketRecordPage(PARAMS)
    expect(result).toBeDefined()
    expect(q.isDocketTracked).not.toHaveBeenCalled()
    expect(q.getDocketFilingsPage).not.toHaveBeenCalled()
  })

  it("gates untracked dockets behind Track (no full-record queries)", async () => {
    q.isDocketTracked.mockResolvedValue(false)
    const result = await DocketRecordPage(PARAMS)
    expect(result).toBeDefined()
    expect(q.getDocketFilingsPage).not.toHaveBeenCalled()
    expect(q.getDocketDeadlines).not.toHaveBeenCalled()
  })

  it("renders the full record for a tracked, entitled docket", async () => {
    q.getDocketDeadlines.mockResolvedValue([
      { type: "hearing", description: "Merits hearing", date: "2026-05-01", estimated: false, link: "https://x/y", mentionCount: 2, daysRemaining: 10 },
    ])
    q.getDocketFilingsPage.mockResolvedValue([
      { id: "f1", title: "Application", docType: "puct-application", filer: "Oncor", filedAt: new Date("2026-04-01"), sourceUrl: "https://x/a", summary: null },
    ])
    const result = await DocketRecordPage(PARAMS)
    expect(result).toBeDefined()
    expect(q.getDocketFilingsPage).toHaveBeenCalledWith("docket-1", 40)
    expect(q.getDocketDeadlines).toHaveBeenCalled()
  })

  it("expands the filing list when ?filings=all is set", async () => {
    const result = await DocketRecordPage({
      params:       Promise.resolve({ docketNumber: "59475" }),
      searchParams: Promise.resolve({ filings: "all" }),
    })
    expect(result).toBeDefined()
    expect(q.getDocketFilingsPage).toHaveBeenCalledWith("docket-1", 300)
  })
})
