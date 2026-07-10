import { describe, it, expect } from "vitest"
import {
  groupConditionalDeadlines,
  groupContestedMilestones,
  type ConditionalDeadline,
  type ContestableDeadline,
} from "../deadline-grouping"

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

  it("collapses a same-date terse + combined restatement (the live A2508008 case)", () => {
    // Row 2 carries BOTH conditions in one clause (sign reads as 'without'), so
    // there's no complementary pair — but same docket+type+date+base ⇒ same
    // deadline. Keep the fullest phrasing, no note.
    const out = groupConditionalDeadlines(
      [
        mk("A2508008", "2026-07-01", "Opening briefs due (if no evidentiary hearing)"),
        mk("A2508008", "2026-07-01", "Opening Briefs due (with evidentiary hearings: August 2026; without: July 1, 2026)"),
      ],
      keyOf,
    )
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe("2026-07-01")
    expect(out[0].description).toMatch(/with evidentiary hearings/i) // fullest wording
    expect(out[0].conditional ?? null).toBeNull() // same date → no cross-date note
  })

  it("collapses the live A2508008 future-dated set from 5 rows to 3", () => {
    const rows: Item[] = [
      mk("A2508008", "2026-07-01", "Opening briefs due (if no evidentiary hearing)"),
      mk("A2508008", "2026-07-01", "Opening Briefs due (with evidentiary hearings: August 2026; without: July 1, 2026)"),
      mk("A2508008", "2026-07-13", "Evidentiary hearing (if needed), between July 13 and July 31, 2026", { type: "hearing" }),
      mk("A2508008", "2026-07-21", "Reply briefs due (if no evidentiary hearing)"),
      mk("A2508008", "2026-07-21", "Reply Briefs due / Matter Submitted (with evidentiary hearings: September 2026; without: July 21, 2026)"),
    ]
    const out = groupConditionalDeadlines(rows, keyOf)
    expect(out).toHaveLength(3)
    expect(out.filter(d => /^opening/i.test(d.description))).toHaveLength(1)
    expect(out.filter(d => /^reply/i.test(d.description))).toHaveLength(1)
    expect(out.filter(d => /evidentiary hearing/i.test(d.description) && d.type === "hearing")).toHaveLength(1)
  })
})

// Cases drawn verbatim from prod docket 58481 (2026-07-10) — the same-date PGRR145 /
// Batch Zero milestone the dashboard was rendering as ~8 near-identical rows because
// it only ran groupConditionalDeadlines, not this second pass (regression guard for
// dashboard/queries.ts).
function cm(date: string, description: string, extra: Partial<ContestableDeadline> = {}): ContestableDeadline {
  return {
    date,
    type: "other",
    description,
    estimated: true,
    mentionCount: 1,
    daysRemaining: 1,
    ...extra,
  }
}

describe("groupContestedMilestones", () => {
  it("collapses the live 58481 Batch Zero / PGRR145 same-date restatements to one row", () => {
    const rows: ContestableDeadline[] = [
      cm("2026-07-10", "Sierra Club recommends the Commission conclude this rulemaking by approximately July 10, 2026, to align with expected approval of PGRR 145 and associated NPRRs."),
      cm("2026-07-10", "PGRR 145 expected approval date (referenced as key coordination milestone for this rulemaking)."),
      cm("2026-07-10", "Expected approval of PGRR 145 (batch zero process); Sierra Club urges Project 58481 rulemaking to be concluded by this date to align with PGRR 145"),
      cm("2026-07-10", "PGRR145 eligibility deadline for Batch Zero intermediate agreements"),
      cm("2026-07-10", "PGRR145 proposed eligibility deadline for Batch Zero loads to execute intermediate agreements"),
      cm("2026-07-10", "Batch Zero Intermediate Agreement (IA) deadline referenced as the target date by which escrow rules and refund timelines must be established."),
      cm("2026-07-10", "Batch Zero Intermediate Agreement (IA) deadline referenced by filers as the date by which escrow rules and refund timelines must be established"),
      cm("2026-07-10", "Large loads must achieve Initial Energization by this date to avoid being subject to the new batch study evaluation criteria under proposed PGRR145 Section 9.2.1.4(3)."),
    ]
    const out = groupContestedMilestones(rows)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe("2026-07-10")
    expect(out[0].mentionCount).toBe(8) // every restatement summed, nothing dropped
    expect(out[0].description).toMatch(/batch/i) // milestone headline, not a raw sentence
  })

  it("keeps a token-disjoint same-date obligation separate (theme-gated)", () => {
    const out = groupContestedMilestones([
      cm("2026-07-10", "PGRR145 eligibility deadline for Batch Zero intermediate agreements"),
      cm("2026-07-10", "PGRR145 proposed eligibility deadline for Batch Zero loads to execute intermediate agreements"),
      cm("2026-07-10", "Quarterly wholesale settlement invoice remittance due to ERCOT"),
    ])
    // The two Batch Zero rows collapse; the unrelated settlement stays its own row.
    expect(out).toHaveLength(2)
  })

  it("leaves a lone deadline on a date untouched", () => {
    const out = groupContestedMilestones([cm("2026-07-10", "Initial briefs due")])
    expect(out).toHaveLength(1)
    expect(out[0].description).toBe("Initial briefs due")
  })
})
