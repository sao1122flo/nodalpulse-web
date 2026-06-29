import { describe, it, expect } from "vitest"
import { groupConditionalDeadlines, type ConditionalDeadline } from "../deadline-grouping"

// Cases drawn verbatim from prod docket A2508008 (the B4 D2 sample).
type Item = ConditionalDeadline & { docket: string }

function mk(docket: string, date: string, description: string, extra: Partial<Item> = {}): Item {
  return {
    docket,
    date,
    type: "other",
    description,
    estimated: true,
    mentionCount: 1,
    daysRemaining: 0,
    ...extra,
  }
}

const keyOf = (i: Item) => i.docket

describe("groupConditionalDeadlines", () => {
  it("collapses complementary with/without variants (different dates) into one row", () => {
    const out = groupConditionalDeadlines(
      [
        mk("A2508008", "2026-05-22", "Opening Briefs (With Evidentiary Hearings)"),
        mk("A2508008", "2026-05-01", "Opening Briefs (Without Evidentiary Hearings)"),
      ],
      keyOf,
    )
    expect(out).toHaveLength(1)
    const row = out[0]
    // Headlines the EARLIER date (conservative — never lull past the sooner one).
    expect(row.date).toBe("2026-05-01")
    expect(row.description).toBe("Opening Briefs")
    expect(row.conditional).toContain("May 1, 2026")
    expect(row.conditional).toContain("May 22, 2026")
    expect(row.conditional).toMatch(/no evidentiary hearing/i)
  })

  it("does NOT merge different bases that share a date (Opening vs Reply briefs)", () => {
    const out = groupConditionalDeadlines(
      [
        mk("A2508008", "2026-05-22", "Opening Briefs (With Evidentiary Hearings)"),
        mk("A2508008", "2026-05-22", "Reply Briefs / Matter Submitted (Without Evidentiary Hearings)"),
      ],
      keyOf,
    )
    expect(out).toHaveLength(2)
  })

  it("handles the 'if (no) evidentiary hearing' phrasing", () => {
    const out = groupConditionalDeadlines(
      [
        mk("A2508008", "2026-07-01", "Opening briefs due (if no evidentiary hearing)"),
        mk("A2508008", "2026-08-15", "Opening briefs due (if evidentiary hearing held)"),
      ],
      keyOf,
    )
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe("2026-07-01")
    expect(out[0].description).toBe("Opening briefs due")
  })

  it("leaves a lone conditional variant untouched (no complement → no collapse)", () => {
    const out = groupConditionalDeadlines(
      [mk("A2508008", "2026-05-22", "Opening Briefs (With Evidentiary Hearings)")],
      keyOf,
    )
    expect(out).toHaveLength(1)
    expect(out[0].description).toBe("Opening Briefs (With Evidentiary Hearings)")
    expect(out[0].conditional ?? null).toBeNull()
  })

  it("does not group non-conditional 'with' usages (e.g. 'with FERC')", () => {
    const out = groupConditionalDeadlines(
      [
        mk("ER26-1", "2026-05-01", "Compliance filing due with FERC"),
        mk("ER26-1", "2026-05-10", "Annual report due without further notice"),
      ],
      keyOf,
    )
    // Neither references a hearing → both sign 0 → pass through unchanged.
    expect(out).toHaveLength(2)
  })

  it("sums mentionCount and promotes to confirmed if any variant is confirmed", () => {
    const out = groupConditionalDeadlines(
      [
        mk("A2508008", "2026-05-22", "Opening Briefs (With Evidentiary Hearings)", { mentionCount: 2 }),
        mk("A2508008", "2026-05-01", "Opening Briefs (Without Evidentiary Hearings)", {
          mentionCount: 3,
          estimated: false,
        }),
      ],
      keyOf,
    )
    expect(out).toHaveLength(1)
    expect(out[0].mentionCount).toBe(5)
    expect(out[0].estimated).toBe(false)
  })

  it("keeps unrelated deadlines and different dockets separate", () => {
    const out = groupConditionalDeadlines(
      [
        mk("A2508008", "2026-05-01", "Opening Briefs (Without Evidentiary Hearings)"),
        mk("A99", "2026-05-22", "Opening Briefs (With Evidentiary Hearings)"),
      ],
      keyOf,
    )
    // Same base + complementary signs but DIFFERENT dockets → not merged.
    expect(out).toHaveLength(2)
  })
})
