import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DashboardDeadline } from "@/app/(app)/dashboard/queries"
import {
  matchesType,
  matchesMarket,
  entitledMarketChips,
  urgencyBucket,
} from "../filters"
import { buildIcs, icsUid } from "../ics"

// ---------------------------------------------------------------------------
// Test data helper
// ---------------------------------------------------------------------------

const mk = (over: Partial<DashboardDeadline> = {}): DashboardDeadline => ({
  docketId:         "d1",
  docketExternalId: "56211",
  docketTitle:      "Oncor rate case",
  jurisdiction:     "PUCT",
  type:             "hearing",
  description:      "Rebuttal testimony due",
  date:             "2026-06-30",
  estimated:        false,
  verifyUrl:        "https://example.com/y",
  daysRemaining:    4,
  mentionCount:     1,
  kind:             "filing",
  ...over,
})

// ---------------------------------------------------------------------------
// filters (pure)
// ---------------------------------------------------------------------------

describe("filters", () => {
  it("maps type chips, with Comment & Protest covering both and Other as catch-all", () => {
    expect(matchesType("hearing", "all")).toBe(true)
    expect(matchesType("comment_deadline", "comment")).toBe(true)
    expect(matchesType("protest_notice", "comment")).toBe(true)
    expect(matchesType("compliance", "compliance")).toBe(true)
    expect(matchesType("effective_date", "effective")).toBe(true)
    // Other = complement of all explicit chips
    expect(matchesType("rehearing", "other")).toBe(true)
    expect(matchesType("calendar", "other")).toBe(true)
    expect(matchesType("hearing", "other")).toBe(false)
    expect(matchesType("comment_deadline", "other")).toBe(false)
  })

  it("matches markets via jurisdiction, folding Texas + mapping FERC variants", () => {
    expect(matchesMarket("PUCT", "texas")).toBe(true)
    expect(matchesMarket("ERCOT", "texas")).toBe(true)
    expect(matchesMarket("CAISO-FERC", "california")).toBe(true)
    expect(matchesMarket("CPUC", "california")).toBe(true)
    expect(matchesMarket("FERC", "ferc")).toBe(true)
    expect(matchesMarket("PUCT", "california")).toBe(false)
    expect(matchesMarket(null, "all")).toBe(true)
    expect(matchesMarket("PUCT", "all")).toBe(true)
  })

  it("shows the FERC chip for CAISO/PJM subscribers", () => {
    expect(entitledMarketChips(["PUCT"]).map(c => c.key)).toEqual(["texas"])
    expect(entitledMarketChips(["CAISO"]).map(c => c.key)).toEqual(["california", "ferc"])
    expect(entitledMarketChips(["PJM"]).map(c => c.key)).toEqual(["pjm", "ferc"])
    expect(entitledMarketChips(["PUCT", "ERCOT", "CAISO", "PJM"]).map(c => c.key))
      .toEqual(["texas", "california", "pjm", "ferc"])
  })

  it("buckets by urgency at the spec thresholds (≤7 / ≤30 / else)", () => {
    expect(urgencyBucket(3)).toBe("thisWeek")
    expect(urgencyBucket(7)).toBe("thisWeek")
    expect(urgencyBucket(8)).toBe("next30")
    expect(urgencyBucket(30)).toBe("next30")
    expect(urgencyBucket(31)).toBe("later")
  })
})

// ---------------------------------------------------------------------------
// ICS (pure)
// ---------------------------------------------------------------------------

describe("buildIcs", () => {
  const STAMP = new Date("2026-06-01T00:00:00.000Z")

  it("emits one VEVENT per deadline", () => {
    const ics = buildIcs([mk(), mk({ date: "2026-07-02", description: "Protest deadline" })], STAMP)
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true)
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true)
  })

  it("never exports an estimated deadline as confirmed", () => {
    const ics = buildIcs([mk({ estimated: true, description: "Protest" })], STAMP)
    expect(ics).toContain("SUMMARY:[est] ")
    expect(ics).toContain("STATUS:TENTATIVE")
    expect(ics).not.toContain("STATUS:CONFIRMED")
  })

  it("marks confirmed deadlines CONFIRMED with no [est] prefix", () => {
    const ics = buildIcs([mk()], STAMP)
    expect(ics).toContain("STATUS:CONFIRMED")
    expect(ics).not.toContain("[est]")
  })

  it("writes all-day DTSTART/DTEND (exclusive end = next day)", () => {
    const ics = buildIcs([mk({ date: "2026-06-30" })], STAMP)
    expect(ics).toContain("DTSTART;VALUE=DATE:20260630")
    expect(ics).toContain("DTEND;VALUE=DATE:20260701")
  })

  it("produces a stable UID that changes only with identity fields", () => {
    expect(icsUid(mk())).toBe(icsUid(mk()))
    expect(icsUid(mk())).not.toBe(icsUid(mk({ description: "Different" })))
    expect(icsUid(mk())).not.toBe(icsUid(mk({ date: "2026-07-01" })))
  })

  it("escapes RFC 5545 special characters in text", () => {
    const ics = buildIcs([mk({ description: "File reply; comments, etc." })], STAMP)
    expect(ics).toContain("File reply\\; comments\\, etc.")
  })
})

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

const { mockGetSession, mockGetEntitlements, mockQ } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetEntitlements: vi.fn(),
  mockQ: {
    getTrackedDocketIds:    vi.fn(),
    getDeadlines:           vi.fn(),
    jurisdictionsForMarkets: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
}))
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/entitlements", () => ({ getEntitlements: mockGetEntitlements }))
vi.mock("@/app/(app)/dashboard/queries", () => ({
  getTrackedDocketIds:     mockQ.getTrackedDocketIds,
  getDeadlines:            mockQ.getDeadlines,
  jurisdictionsForMarkets: mockQ.jurisdictionsForMarkets,
}))
vi.mock("../DeadlinesClient", () => ({ DeadlinesClient: () => null }))

import DeadlinesPage from "../page"

describe("DeadlinesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@test.com" } })
    mockGetEntitlements.mockResolvedValue({ marketAccess: ["PUCT"] })
    mockQ.jurisdictionsForMarkets.mockReturnValue(["PUCT"])
    mockQ.getTrackedDocketIds.mockResolvedValue(["d1"])
    mockQ.getDeadlines.mockResolvedValue([])
  })

  it("redirects to /login when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(DeadlinesPage()).rejects.toThrow("NEXT_REDIRECT")
  })

  it("renders the empty state without querying deadlines when no dockets are tracked", async () => {
    mockQ.getTrackedDocketIds.mockResolvedValue([])
    const result = await DeadlinesPage()
    expect(result).toBeDefined()
    expect(mockQ.getDeadlines).not.toHaveBeenCalled()
  })

  it("fetches deadlines with the dedicated-page limit for tracked dockets", async () => {
    const result = await DeadlinesPage()
    expect(result).toBeDefined()
    expect(mockQ.getDeadlines).toHaveBeenCalledWith(["d1"], ["PUCT"], expect.any(String), 500)
  })
})
