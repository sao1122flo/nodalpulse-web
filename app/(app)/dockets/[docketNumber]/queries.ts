import { db } from "@/db/client"
import { dockets, filings, extractions, userDockets, filingDockets } from "@/db/schema"
import { and, eq, asc, desc, isNotNull, count, inArray, ne, sql } from "drizzle-orm"
import { bestSourceLink, isBrokenFercSearchUrl, fercAccessionUrl } from "@/lib/ferc-links"
import type { LinkedDocket } from "@/app/(app)/dashboard/queries"

// Re-export so the page has a single import surface for the cross-jurisdiction type.
export type { LinkedDocket } from "@/app/(app)/dashboard/queries"

const DAYS_MS = 86_400_000

// ---------------------------------------------------------------------------
// resolveDocket — find the docket row by external_id (URL segment), excluding
// ghost rows (jurisdiction IS NULL). When multiple rows share the external_id
// (cross-source duplicates), pick the one with the most filings — deterministic
// and content-rich. Mirrors the disambiguation in the legacy detail page.
// ---------------------------------------------------------------------------

export interface DocketHeader {
  id:           string
  externalId:   string
  title:        string | null
  jurisdiction: string | null
  status:       string
  openedAt:     string | null
}

export async function resolveDocket(docketNumber: string): Promise<DocketHeader | null> {
  const [row] = await db
    .select({
      id:           dockets.id,
      externalId:   dockets.externalId,
      title:        dockets.title,
      jurisdiction: dockets.jurisdiction,
      status:       dockets.status,
      openedAt:     dockets.openedAt,
    })
    .from(dockets)
    .leftJoin(filings, eq(filings.docketId, dockets.id))
    .where(and(eq(dockets.externalId, docketNumber), isNotNull(dockets.jurisdiction)))
    .groupBy(dockets.id)
    .orderBy(desc(count(filings.id)))
    .limit(1)

  return row ?? null
}

// ---------------------------------------------------------------------------
// isDocketTracked — userDockets membership for the current user.
// ---------------------------------------------------------------------------

export async function isDocketTracked(userId: string, docketId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userDockets.id })
    .from(userDockets)
    .where(and(eq(userDockets.userId, userId), eq(userDockets.docketId, docketId)))
    .limit(1)
  return !!row
}

// ---------------------------------------------------------------------------
// getDocketMeta — filing count + first/last activity (COUNT, not a full fetch).
// ---------------------------------------------------------------------------

export interface DocketMeta {
  filingCount:  number
  firstFiledAt: Date | null
  lastFiledAt:  Date | null
}

export async function getDocketMeta(docketId: string): Promise<DocketMeta> {
  const [row] = await db
    .select({
      filingCount: count(filings.id),
      firstFiled:  sql<string | null>`min(${filings.filedAt})`,
      lastFiled:   sql<string | null>`max(${filings.filedAt})`,
    })
    .from(filings)
    .where(eq(filings.docketId, docketId))

  return {
    filingCount:  Number(row?.filingCount ?? 0),
    firstFiledAt: row?.firstFiled ? new Date(row.firstFiled) : null,
    lastFiledAt:  row?.lastFiled ? new Date(row.lastFiled) : null,
  }
}

// ---------------------------------------------------------------------------
// getDocketFilingsPage — newest-first filings for the timeline, capped at
// `limit`. Pair with getDocketMeta().filingCount to show "latest N of M".
// ---------------------------------------------------------------------------

export interface RecordFiling {
  id:        string
  title:     string
  docType:   string
  filer:     string | null
  filedAt:   Date
  sourceUrl: string | null
  summary:   string | null
}

export async function getDocketFilingsPage(docketId: string, limit: number): Promise<RecordFiling[]> {
  const rows = await db
    .select({
      id:        filings.id,
      title:     filings.title,
      docType:   filings.docType,
      filer:     filings.filer,
      filedAt:   filings.filedAt,
      sourceUrl: filings.sourceUrl,
      payload:   extractions.payload,
    })
    .from(filings)
    .leftJoin(extractions, eq(extractions.filingId, filings.id))
    .where(eq(filings.docketId, docketId))
    .orderBy(desc(filings.filedAt))
    .limit(limit)

  return rows.map(r => ({
    id:        r.id,
    title:     r.title,
    docType:   r.docType,
    filer:     r.filer,
    filedAt:   r.filedAt,
    sourceUrl: r.sourceUrl,
    summary:   r.payload?.summary ?? null,
  }))
}

// ---------------------------------------------------------------------------
// getDocketParties — deduped party names across the docket's filings.
// Strips LLM-appended role annotations like " (Intervenor, pro se)" before
// dedup; canonical-name cleanup is services #116.
// ---------------------------------------------------------------------------

// A party with a best-effort role. Roles are heuristic in Phase 1 (Applicant =
// filer of the application; Staff/Consumer Advocate by name; Intervenor from the
// interventions list). Phase 2 (#services) will supply authoritative roles.
export interface DocketParty {
  name: string
  role: string | null
}

const ROLE_ORDER: Record<string, number> = {
  Applicant: 0,
  Staff: 1,
  "Consumer Advocate": 2,
  Intervenor: 3,
  Protestant: 4,
  Commenter: 5,
}

export async function getDocketParties(docketId: string): Promise<DocketParty[]> {
  const rows = await db
    .select({ filer: filings.filer, docType: filings.docType, payload: extractions.payload })
    .from(filings)
    .leftJoin(extractions, eq(extractions.filingId, filings.id))
    .where(eq(filings.docketId, docketId))
    .orderBy(asc(filings.filedAt)) // earliest first so the application's filer wins for Applicant
    .limit(300)

  const normalize = (n: string) => n.replace(/\s*\(.*$/, "").trim()

  const names = new Set<string>()
  const intervenors = new Set<string>()
  const realRole = new Map<string, string>()  // authoritative party_role (prompt_ver 1.6+)
  let applicant: string | null = null

  for (const r of rows) {
    for (const p of r.payload?.parties ?? []) {
      const n = normalize(p)
      if (n) names.add(n)
    }
    for (const iv of r.payload?.interventions ?? []) {
      const n = normalize(iv.party)
      if (!n) continue
      intervenors.add(n)
      const pr = iv.party_role?.trim()
      if (pr && !realRole.has(n)) realRole.set(n, pr.toLowerCase())
    }
    if (!applicant && r.filer && /application/i.test(r.docType)) {
      applicant = normalize(r.filer)
      if (applicant) names.add(applicant)
    }
  }

  const isStaff = (n: string) => /\b(puct staff|commission staff|public utility commission|puc staff)\b/i.test(n)
  const isConsumerAdvocate = (n: string) => /office of public utility counsel|consumer counsel/i.test(n)

  // Authoritative role label (1.6+ extraction) takes precedence over the heuristics.
  const REAL_LABEL: Record<string, string> = {
    applicant: "Applicant", intervenor: "Intervenor", protestant: "Protestant",
    staff: "Staff", commenter: "Commenter",
  }

  const roleFor = (n: string): string | null => {
    const real = realRole.get(n)
    if (real) return REAL_LABEL[real] ?? (real.charAt(0).toUpperCase() + real.slice(1))
    if (applicant && n === applicant) return "Applicant"
    if (isStaff(n)) return "Staff"
    if (isConsumerAdvocate(n)) return "Consumer Advocate"
    if (intervenors.has(n)) return "Intervenor"
    return null
  }

  return [...names]
    .filter(Boolean)
    .map(name => ({ name, role: roleFor(name) }))
    .sort((a, b) => {
      const ra = a.role ? ROLE_ORDER[a.role] ?? 8 : 99
      const rb = b.role ? ROLE_ORDER[b.role] ?? 8 : 99
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name)
    })
}

// ---------------------------------------------------------------------------
// getDocketDeadlines — P0. Filing-attached deadlines for THIS docket, semantic-
// deduped, with a hard data-quality rule: every rendered deadline carries a
// source link. `link` prefers the per-deadline verify_url and falls back to the
// originating filing's source_url; deadlines with neither link are suppressed.
// `estimated` is conservative — absent => estimated (never shown as confirmed).
// ---------------------------------------------------------------------------

export interface RecordDeadline {
  type:         string
  description:  string
  date:         string
  estimated:    boolean
  link:         string | null
  mentionCount: number
  daysRemaining: number
  actor:        string | null   // who must act (prompt_ver 1.6+); null on older extractions
}

// Treat blank/whitespace-only strings as "no link" — extraction payloads carry
// empty-string URLs (e.g. FERC filings with source_url="") that must NOT count
// as a source under the P0 data-quality rule.
const cleanUrl = (s: string | null | undefined): string | null => {
  const v = s?.trim()
  return v ? v : null
}

// Fuzzy near-duplicate detection for deadline descriptions. Filings phrase the
// same deadline differently ("EIA Form EIA-861M OMB approval expiration" vs
// "EIA Form OMB approval expiration"); exact-key dedup misses these. We compare
// significant-token sets and only merge when overlap is high — distinct same-day
// obligations (e.g. "PJM must file…" vs "PJM transmission owners must file…")
// stay separate.
const DEADLINE_STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "for", "per", "on", "and", "or", "its", "this",
  "that", "by", "in", "is", "are", "be", "with", "as", "at", "from",
])

function descTokens(desc: string): Set<string> {
  return new Set(
    desc.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !DEADLINE_STOPWORDS.has(t))
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

const DEADLINE_MERGE_THRESHOLD = 0.6

export async function getDocketDeadlines(docketId: string, today: string): Promise<RecordDeadline[]> {
  const todayMs = new Date(today + "T00:00:00Z").getTime()

  const rows = await db
    .select({ sourceUrl: filings.sourceUrl, filingExternalId: filings.externalId, payload: extractions.payload })
    .from(filings)
    .innerJoin(extractions, eq(extractions.filingId, filings.id))
    .where(eq(filings.docketId, docketId))

  // groups hold the per-row link (verify_url, else originating filing's URL).
  // docketSource is a docket-level fallback: the first real URL found anywhere
  // in this docket's extractions — including undated entries, which on FERC
  // dockets carry the eLibrary docket link. Lets a dated deadline that lacks its
  // own URL still resolve to a verifiable docket source instead of being dropped.
  const groups  = new Map<string, RecordDeadline & { _perRow: string | null }>()
  const descLen = new Map<string, number>()
  let docketSource: string | null = null

  for (const row of rows) {
    docketSource = docketSource ?? cleanUrl(row.sourceUrl) ?? fercAccessionUrl(row.filingExternalId)
    for (const dl of row.payload?.deadlines ?? []) {
      const dv = cleanUrl(dl.verify_url)
      if (dv && !isBrokenFercSearchUrl(dv)) docketSource = docketSource ?? dv
      if (!dl.date || dl.date < today) continue
      const norm = dl.description.toLowerCase().replace(/\s+/g, " ").trim()
      const type = dl.type ?? "other"
      const key  = `${dl.date}:${type}:${norm.slice(0, 80)}`
      // FERC-aware: real verify_url (not the broken ?q= search) → filing
      // source_url → FERC accession filelist link (from the filing external_id).
      const perRow = bestSourceLink(dl.verify_url, row.sourceUrl, row.filingExternalId)
      const daysRemaining = Math.ceil(
        (new Date(dl.date + "T12:00:00Z").getTime() - todayMs) / DAYS_MS
      )

      const existing = groups.get(key)
      if (!existing) {
        groups.set(key, {
          type,
          description:  dl.description,
          date:         dl.date,
          estimated:    dl.estimated ?? true,
          link:         null, // resolved after the loop
          _perRow:      perRow,
          mentionCount: 1,
          daysRemaining,
          actor:        dl.actor?.trim() || null,
        })
        descLen.set(key, dl.description.length)
      } else {
        existing.mentionCount++
        const prevLen = descLen.get(key) ?? 0
        if (dl.description.length > prevLen) {
          existing.description = dl.description
          descLen.set(key, dl.description.length)
        }
        // Any confirmed mention promotes the group to confirmed.
        if (!(dl.estimated ?? true)) existing.estimated = false
        // Prefer a real per-row verify_url (not the broken search URL); otherwise
        // keep the first usable link (filing source_url / FERC accession).
        if (dv && !isBrokenFercSearchUrl(dv)) existing._perRow = dv
        else if (!existing._perRow && perRow) existing._perRow = perRow
        if (!existing.actor && dl.actor?.trim()) existing.actor = dl.actor.trim()
      }
    }
  }

  // Resolve each deadline's link: its own source, else the docket-level source.
  // Data-quality gate: never render an extracted deadline without a source link.
  const resolved = [...groups.values()]
    .map(({ _perRow, ...d }) => ({ ...d, link: _perRow ?? docketSource }))
    .filter(d => d.link !== null)

  // Second pass: fuzzy-merge near-identical descriptions sharing (date, type).
  // Keeps the most complete wording, sums mention counts, and promotes to
  // confirmed if any merged mention was confirmed.
  const merged: (RecordDeadline & { _tokens: Set<string> })[] = []
  for (const d of resolved) {
    const tokens = descTokens(d.description)
    const hit = merged.find(
      m => m.date === d.date && m.type === d.type && jaccard(m._tokens, tokens) >= DEADLINE_MERGE_THRESHOLD
    )
    if (!hit) {
      merged.push({ ...d, _tokens: tokens })
      continue
    }
    hit.mentionCount += d.mentionCount
    if (!d.estimated) hit.estimated = false
    if (!hit.actor && d.actor) hit.actor = d.actor
    if (d.description.length > hit.description.length) {
      // Prefer the most complete wording, and the link that came with it.
      hit.description = d.description
      hit._tokens = tokens
      if (d.link) hit.link = d.link
    }
  }

  return merged
    .map(({ _tokens, ...d }) => d)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
}

// ---------------------------------------------------------------------------
// getLinkedDockets — cross-jurisdiction links via the filing_dockets junction.
// Finds every filing this docket appears on (any caption), then the OTHER
// dockets sharing those filings. Returns [] when there are no links.
// ---------------------------------------------------------------------------

// LinkedDocket plus a relationship reason from this docket's docket_linkages
// (prompt_ver 1.6+). reason is null on older extractions.
export type RecordLinkedDocket = LinkedDocket & { reason: string | null }

const normKey = (s: string) => s.replace(/[\s.\-_]/g, "").toUpperCase()

export async function getLinkedDockets(docketId: string): Promise<RecordLinkedDocket[]> {
  const fdRows = await db
    .select({ filingId: filingDockets.filingId })
    .from(filingDockets)
    .where(eq(filingDockets.docketId, docketId))
    .limit(300)

  if (fdRows.length === 0) return []
  const filingIds = [...new Set(fdRows.map(r => r.filingId))]

  const linked = await db
    .select({
      id:           dockets.id,
      externalId:   dockets.externalId,
      title:        dockets.title,
      jurisdiction: dockets.jurisdiction,
    })
    .from(filingDockets)
    .innerJoin(dockets, eq(dockets.id, filingDockets.docketId))
    .where(and(inArray(filingDockets.filingId, filingIds), ne(filingDockets.docketId, docketId)))
    .limit(50)

  // Relationship reasons from this docket's own extractions (docket_linkages).
  // Keyed loosely (strip punctuation/case) so "EL25-49" matches "EL25-49-000" etc.
  const reasonByDocket = new Map<string, string>()
  const linkRows = await db
    .select({ payload: extractions.payload })
    .from(filings)
    .innerJoin(extractions, eq(extractions.filingId, filings.id))
    .where(eq(filings.docketId, docketId))
    .limit(300)
  for (const r of linkRows) {
    for (const dl of r.payload?.docket_linkages ?? []) {
      const k = normKey(dl.docket ?? "")
      const reason = dl.reason?.trim()
      if (k && reason && !reasonByDocket.has(k)) reasonByDocket.set(k, reason)
    }
  }

  const matchReason = (externalId: string): string | null => {
    const k = normKey(externalId)
    if (reasonByDocket.has(k)) return reasonByDocket.get(k)!
    // prefix match either direction (handles trailing sub-docket suffixes)
    for (const [rk, rv] of reasonByDocket) {
      if (rk.startsWith(k) || k.startsWith(rk)) return rv
    }
    return null
  }

  const seen = new Set<string>()
  const out: RecordLinkedDocket[] = []
  for (const r of linked) {
    if (seen.has(r.externalId)) continue
    seen.add(r.externalId)
    out.push({
      id: r.id, externalId: r.externalId, title: r.title, jurisdiction: r.jurisdiction,
      reason: matchReason(r.externalId),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// getDocketSalience — per-docket "what's driving" signal (#128). Reads the
// services-owned market_salience table keyed by docket_key (= external_id) for
// the most recent week. Returns null (card hidden) on no signal or any error —
// the table may not exist in every environment.
// ---------------------------------------------------------------------------

export interface DocketSalience {
  market:   string
  rank:     number
  score:    number
  headline: string | null
  // Week-over-week trend derived from the two most recent salient weeks (2a).
  trend:           "accelerating" | "steady" | "cooling" | null
  filingsMultiple: number | null   // e.g. 3 → "filing volume up 3×"
}

export async function getDocketSalience(externalId: string): Promise<DocketSalience | null> {
  try {
    const rows = await db.execute<{
      market:        string
      rank:          number
      score:         string
      headline:      string | null
      filings_count: number | null
    }>(sql`
      SELECT market, rank, score::float AS score, headline, filings_count
      FROM market_salience
      WHERE docket_key = ${externalId}
        AND week_start >= (CURRENT_DATE - INTERVAL '28 days')::date
      ORDER BY week_start DESC
      LIMIT 2
    `)
    const cur = rows[0]
    if (!cur) return null
    const prev = rows[1] ?? null

    let trend: DocketSalience["trend"] = null
    let filingsMultiple: number | null = null
    if (prev) {
      const cs = Number(cur.score), ps = Number(prev.score)
      if (ps > 0) {
        if (cs >= ps * 1.2)      trend = "accelerating"
        else if (cs <= ps * 0.8) trend = "cooling"
        else                     trend = "steady"
      }
      const cf = Number(cur.filings_count ?? 0), pf = Number(prev.filings_count ?? 0)
      if (pf > 0 && cf >= pf * 2) filingsMultiple = Math.round(cf / pf)
    }

    return {
      market:          cur.market,
      rank:            Number(cur.rank),
      score:           Number(cur.score),
      headline:        cur.headline ?? null,
      trend,
      filingsMultiple,
    }
  } catch {
    return null
  }
}
