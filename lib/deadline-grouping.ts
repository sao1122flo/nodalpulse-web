// B4 D2 — conditional deadline grouping (read-time, conservative).
//
// Proceedings re-state the SAME briefing deadline several ways across filings,
// e.g. (validated against prod, docket A2508008):
//   "Opening briefs due (if no evidentiary hearing)"                           → Jul 1
//   "Opening Briefs due (with evidentiary hearings: Aug 2026; without: Jul 1)" → Jul 1
//   "Opening Briefs (Without Evidentiary Hearings)"                            → May 1
//   "Opening Briefs (With Evidentiary Hearings)"                               → May 22
// Exact/fuzzy dedup leaves these as separate rows (the conditional clauses add
// divergent tokens, so full-text overlap is low). We collapse them per
// docket+type by the CONDITION-STRIPPED base:
//   • same date  → one row, keep the fullest phrasing (it's literally the same
//     deadline restated).
//   • different dates with complementary with/without → one row that headlines
//     the EARLIER date (never lull past the sooner deadline) + a conditional note.
// Nothing is ever deleted — mention counts sum and a confirmed mention wins.
//
// Guardrails (from the sample — base-equality is the only safe signal):
//   • a clause must reference a hearing, so the 75 future deadlines that merely
//     say "with" ("file with FERC") are untouched.
//   • cluster ONLY within the same docket + type and base Jaccard ≥ 0.6 — the
//     same threshold the record fuzzy-merge uses. This rejects the real
//     same-date "Opening Briefs" vs "Reply Briefs" pair (Jaccard 0.5) in prod.
// Pure + server-safe (no db / framework imports).

export interface ConditionalDeadline {
  date:          string
  type:          string
  description:   string
  estimated:     boolean
  mentionCount:  number
  daysRemaining: number
  conditional?:  string | null
}

// Trailing "(with|without|if … hearing …)" clause. Allows the parenthetical and
// the bare-clause forms; "hearings?" covers the plural the data uses.
const CONDITION_CLAUSE =
  /[\s(,;:–-]*\b(?:with|without|if)\b[^()]*\bhearings?\b[^()]*\)?\s*$/i

const BASE_SIM_THRESHOLD = 0.6

interface Condition {
  sign: -1 | 0 | 1 // -1 without/no hearing, +1 with/if-held, 0 = not conditional
  base: string // case-preserved description minus the condition clause
}

function conditionOf(description: string): Condition {
  const m = description.match(CONDITION_CLAUSE)
  if (!m || m.index === undefined || m.index === 0) return { sign: 0, base: description }
  const clause = m[0].toLowerCase()
  const sign: -1 | 1 = /\bwithout\b|\bno\b/.test(clause) ? -1 : 1
  const base = description.slice(0, m.index).replace(/[\s(,;:–-]+$/, "").trim()
  // Require a non-trivial base (≥2 significant tokens) so a flimsy stub never groups.
  if (baseTokens(base).size < 2) return { sign: 0, base: description }
  return { sign, base }
}

function baseTokens(base: string): Set<string> {
  return new Set(base.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
    timeZone: "UTC",
  })
}

interface Entry<T> {
  item: T
  sign: -1 | 1
  base: string
  tokens: Set<string>
}

// ── Contested-milestone grouping (same date, same theme, different parties) ──
//
// Distinct from the conditional (with/without-hearing) grouping above. Parties in
// a proceeding propose or reference DIFFERENT obligations that converge on the SAME
// date+theme — e.g. docket 58481, 2026-07-10: "Initial Energization", "Batch Zero
// IA deadline", "PGRR145 eligibility", "conclude rulemaking", "RPG study acceptance"
// (11 mentions from Permian Basin / Landmark / Eolic / Sierra Club / Tract). They are
// NOT the same phrasing, so exact + fuzzy dedup leave them as separate rows; but they
// ARE the same contested date. We collapse them into ONE "contested milestone" row for
// the headline while preserving EVERY party's ask verbatim in `positions` — nothing is
// fused or deleted, so the collapse stays honest even when generous. Theme-gated so a
// genuinely unrelated same-date obligation never merges in.

export interface DeadlinePosition {
  description:  string
  parties:      string[]
  actor:        string | null
  link:         string | null
  estimated:    boolean
  mentionCount: number
}

export interface ContestableDeadline extends ConditionalDeadline {
  parties?:   string[]
  actor?:     string | null
  link?:      string | null
  contested?: boolean
  positions?: DeadlinePosition[]
}

// Generic words that must not become the milestone label — leaves domain terms
// (batch, zero, pgrr145, energization, attestation, …) as the headline signal.
const LABEL_STOPWORDS = new Set([
  "deadline", "date", "dates", "proposed", "expected", "referenced", "reference",
  "target", "recommend", "recommends", "recommended", "urges", "urge", "key",
  "milestone", "process", "filing", "filed", "filers", "commenters", "commission",
  "must", "this", "that", "which", "approximately", "begin", "beginning", "under",
  "section", "related", "complete", "completion", "achieve", "achieved", "subject",
  "other", "estimated", "within", "before", "after", "have", "been", "with", "without",
  // dates / generic verbs / quantifiers — never a milestone name.
  "january", "february", "march", "april", "june", "july", "august", "september",
  "october", "november", "december", "days", "large", "loads", "load", "projects",
  "project", "signed", "sign", "execute", "executed", "meet", "revised", "promulgated",
  "standards", "value", "values", "annual", "annually", "every", "thereafter", "seeking",
])

function significantTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t) && !LABEL_STOPWORDS.has(t))
}

function titleCaseTerm(s: string): string {
  return s
    .split(" ")
    .map((w) => {
      if (w === w.toUpperCase()) return w
      if (/\d/.test(w)) return w.toUpperCase() // acronym-codes: pgrr145 → PGRR145
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(" ")
}

// Milestone label. Prefer the most frequent domain BIGRAM (e.g. "Batch Zero",
// "Financial Security") — two-token terms read as real milestone names; single
// top-tokens produced awkward "Batch · Zero" / "2027 · January" headlines. Fall back
// to the top unigram, then the shortest member description, so the headline is always
// a real phrase from the record, never a synthetic mash-up.
function milestoneLabel(descriptions: string[]): string {
  const bi  = new Map<string, number>()
  const uni = new Map<string, number>()
  for (const d of descriptions) {
    const toks = significantTokens(d)
    for (const t of new Set(toks)) uni.set(t, (uni.get(t) ?? 0) + 1)
    const seen = new Set<string>()
    for (let i = 0; i < toks.length - 1; i++) {
      const bg = `${toks[i]} ${toks[i + 1]}`
      if (!seen.has(bg)) { seen.add(bg); bi.set(bg, (bi.get(bg) ?? 0) + 1) }
    }
  }
  const pick = (m: Map<string, number>) =>
    [...m.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0]
  const topBi = pick(bi)
  if (topBi) return titleCaseTerm(topBi)
  const topUni = pick(uni)
  if (topUni) return titleCaseTerm(topUni)
  const shortest = descriptions.reduce((b, d) => (d.length < b.length ? d : b), descriptions[0])
  return shortest.length > 72 ? shortest.slice(0, 69).trimEnd() + "…" : shortest
}

export function groupContestedMilestones<T extends ContestableDeadline>(items: T[]): T[] {
  const byDate = new Map<string, T[]>()
  for (const it of items) {
    const b = byDate.get(it.date)
    if (b) b.push(it)
    else byDate.set(it.date, [it])
  }

  const out: T[] = []
  for (const group of byDate.values()) {
    if (group.length < 2) {
      out.push(...group)
      continue
    }
    // Theme-cluster within the date via connected components (union-find): two items
    // are linked if they share ≥1 significant (domain) token, TRANSITIVELY. This bridges
    // e.g. "Batch Zero cutoff" ↔ "conclude the rulemaking" through a party ask that
    // mentions both ("…urges the Project 58481 rulemaking… batch zero…"), collapsing the
    // whole contested date to one row — while a token-disjoint unrelated obligation on the
    // same date (e.g. a Quarterly Stability Assessment) stays its own component. Greedy
    // first-match missed these bridges (order-dependent); components are order-invariant.
    const n = group.length
    const parent = Array.from({ length: n }, (_, i) => i)
    const find = (x: number): number => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
      return x
    }
    const tokSets = group.map((it) => new Set(significantTokens(it.description)))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let shared = false
        for (const t of tokSets[i]) if (tokSets[j].has(t)) { shared = true; break }
        if (shared) parent[find(i)] = find(j)
      }
    }
    const byRoot = new Map<number, T[]>()
    for (let i = 0; i < n; i++) {
      const r = find(i)
      const b = byRoot.get(r)
      if (b) b.push(group[i])
      else byRoot.set(r, [group[i]])
    }
    const clusters = [...byRoot.values()].map((members) => ({ members }))

    for (const { members } of clusters) {
      if (members.length < 2) {
        out.push(members[0])
        continue
      }
      const sorted = [...members].sort((a, b) => b.mentionCount - a.mentionCount)
      const rep = sorted[0]
      const positions: DeadlinePosition[] = sorted.map((m) => ({
        description:  m.description,
        parties:      m.parties ?? [],
        actor:        m.actor ?? null,
        link:         m.link ?? null,
        estimated:    m.estimated,
        mentionCount: m.mentionCount,
      }))
      out.push({
        ...rep,
        description:  milestoneLabel(members.map((m) => m.description)),
        contested:    true,
        positions,
        parties:      [...new Set(sorted.flatMap((m) => m.parties ?? []))],
        mentionCount: sorted.reduce((n, m) => n + m.mentionCount, 0),
        estimated:    sorted.every((m) => m.estimated),
        conditional:  null,
      })
    }
  }
  return out
}

export function groupConditionalDeadlines<T extends ConditionalDeadline>(
  items: T[],
  docketKeyOf: (item: T) => string,
): T[] {
  const result: T[] = []
  // Bucket conditional entries by docket+type; non-conditional pass straight through.
  const buckets = new Map<string, Entry<T>[]>()
  for (const item of items) {
    const cond = conditionOf(item.description)
    if (cond.sign === 0) {
      result.push(item)
      continue
    }
    const key = `${docketKeyOf(item)}::${item.type}`
    const entry: Entry<T> = { item, sign: cond.sign, base: cond.base, tokens: baseTokens(cond.base) }
    const bucket = buckets.get(key)
    if (bucket) bucket.push(entry)
    else buckets.set(key, [entry])
  }

  for (const bucket of buckets.values()) {
    // Greedily cluster by base similarity (same obligation, different phrasings).
    const clusters: Entry<T>[][] = []
    for (const entry of bucket) {
      const hit = clusters.find(c => jaccard(c[0].tokens, entry.tokens) >= BASE_SIM_THRESHOLD)
      if (hit) hit.push(entry)
      else clusters.push([entry])
    }

    for (const cluster of clusters) {
      if (cluster.length === 1) {
        result.push(cluster[0].item)
        continue
      }
      const sorted = [...cluster].sort((a, b) => a.item.date.localeCompare(b.item.date))
      const rep = sorted[0].item // earliest → conservative headline (date/link/etc.)
      const dates = new Set(sorted.map(e => e.item.date))
      const hasWithout = sorted.some(e => e.sign === -1)
      const hasWith = sorted.some(e => e.sign === 1)
      const longestDesc = sorted.reduce((b, e) =>
        e.item.description.length > b.length ? e.item.description : b, "")
      const longestBase = sorted.reduce((b, e) => (e.base.length > b.length ? e.base : b), "")

      let description = longestDesc
      let conditional: string | null = null
      // Cross-date complementary → clean base + a note spelling out both dates.
      if (dates.size > 1 && hasWithout && hasWith) {
        const withoutDate = sorted.filter(e => e.sign === -1)[0].item.date
        const withDate    = sorted.filter(e => e.sign === 1)[0].item.date
        description = longestBase || longestDesc
        conditional = `${fmtDate(withoutDate)} if no evidentiary hearing · ${fmtDate(withDate)} if a hearing is held`
      }

      result.push({
        ...rep,
        description,
        conditional,
        mentionCount: cluster.reduce((n, e) => n + e.item.mentionCount, 0),
        estimated:    cluster.every(e => e.item.estimated),
      })
    }
  }

  return result
}
