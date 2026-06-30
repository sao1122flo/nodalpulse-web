import { db } from "@/db/client"
import {
  userDockets,
  dockets,
  filings,
  extractions,
  teamMemberships,
  filingDockets,
  watchedEntities,
} from "@/db/schema"
import { and, eq, inArray, notInArray, desc, gte, sql, isNotNull } from "drizzle-orm"
import { bestSourceLink, isBrokenFercSearchUrl, fercAccessionUrl } from "@/lib/ferc-links"
import { groupConditionalDeadlines } from "@/lib/deadline-grouping"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackedDocket {
  id: string
  externalId: string
  title: string | null
  jurisdiction: string | null
  status: string
}

export interface DashboardDeadline {
  docketId: string
  docketExternalId: string
  docketTitle: string | null
  jurisdiction: string | null
  type: string
  description: string
  date: string
  estimated: boolean
  verifyUrl: string | null
  daysRemaining: number
  mentionCount: number
  // B4: when a deadline has complementary with/without-hearing variants on
  // different dates, they collapse to one row headlining the earlier date and
  // this note explains the conditional later date. null for ordinary deadlines.
  conditional?: string | null
  // 2b: distinguishes filing-extracted deadlines from market_events calendar
  // entries. market_events get a "Market event" chip (no Record-page link) and
  // are treated as confirmed (authoritative calendar dates, not extractions).
  kind: "filing" | "market_event"
}

export interface FeedItem {
  filingId: string
  filingTitle: string
  docType: string
  filedAt: Date
  sourceUrl: string | null
  summary: string | null
  docketId: string
  docketExternalId: string
  docketTitle: string | null
  jurisdiction: string | null
}

export interface FeedGroup {
  docketId: string
  docketExternalId: string
  docketTitle: string | null
  jurisdiction: string | null
  items: FeedItem[]
}

export interface LinkedDocket {
  id: string
  externalId: string
  title: string | null
  jurisdiction: string | null
}

export interface MatterThread {
  docketId: string
  externalId: string
  title: string | null
  jurisdiction: string | null
  status: string
  nextDeadline: DashboardDeadline | null
  parties: string[]
  linkedDockets: LinkedDocket[]
}

// ---------------------------------------------------------------------------
// Market access → jurisdiction mapping
// dockets.jurisdiction values: "PUCT","ERCOT","FERC","CAISO-FERC","CPUC","PJM-FERC"
// marketAccess entitlement codes: "PUCT","ERCOT","CAISO","PJM"
// ---------------------------------------------------------------------------

export const MARKET_TO_JURISDICTIONS: Record<string, string[]> = {
  PUCT:  ["PUCT"],
  ERCOT: ["ERCOT"],
  // "FERC" included so on-demand-tracked FERC-format dockets (jurisdiction='FERC')
  // surface under the California and PJM chips until the jurisdiction is narrowed
  // by the daily crawl.  v1 limitation: an ER/EL docket defaults to 'FERC'; it
  // shows under both chips rather than the precise one.  Tracked in #87.
  CAISO: ["CAISO-FERC", "CAISO", "CPUC", "FERC"],
  // NJ-BPU (New Jersey state PUC) is geographically PJM — a PJM subscriber sees it.
  PJM:   ["PJM-FERC", "PJM", "NJ-BPU", "FERC"],
  FERC:  ["FERC"],
}

export const JURISDICTION_TO_MARKET: Record<string, string> = {
  PUCT:       "PUCT",
  ERCOT:      "ERCOT",
  "CAISO-FERC": "CAISO",
  CAISO:      "CAISO",
  CPUC:       "CAISO",
  "PJM-FERC": "PJM",
  PJM:        "PJM",
  "NJ-BPU":   "PJM",
  FERC:       "FERC",
}

/** Expand a set of market codes to all matching jurisdiction strings. */
export function jurisdictionsForMarkets(markets: string[]): string[] {
  const out = new Set<string>()
  for (const m of markets) {
    for (const j of MARKET_TO_JURISDICTIONS[m] ?? []) out.add(j)
  }
  return [...out]
}

const DAYS_MS = 86_400_000
const FEED_DAYS = 7

// ---------------------------------------------------------------------------
// getTrackedDocketIds
// Mine:  own user_dockets
// Team:  own + accepted members' user_dockets (no schema change)
// ---------------------------------------------------------------------------

export async function getTrackedDocketIds(
  userId: string,
  includeTeam: boolean,
): Promise<string[]> {
  const own = await db
    .select({ docketId: userDockets.docketId })
    .from(userDockets)
    .where(eq(userDockets.userId, userId))

  const ids = new Set(own.map(r => r.docketId))

  if (includeTeam) {
    const members = await db
      .select({ inviteeUserId: teamMemberships.inviteeUserId })
      .from(teamMemberships)
      .where(
        and(
          eq(teamMemberships.ownerId, userId),
          eq(teamMemberships.status, "accepted"),
        )
      )

    const memberIds = members
      .map(r => r.inviteeUserId)
      .filter((v): v is string => v != null)

    if (memberIds.length > 0) {
      const memberDockets = await db
        .select({ docketId: userDockets.docketId })
        .from(userDockets)
        .where(inArray(userDockets.userId, memberIds))
      for (const r of memberDockets) ids.add(r.docketId)
    }
  }

  return [...ids]
}

// ---------------------------------------------------------------------------
// Deadline semantic dedup helpers
// ---------------------------------------------------------------------------

// Treat blank/whitespace-only strings as "no link" — extraction payloads carry
// empty-string URLs (e.g. FERC filings with source_url="") that must not count
// as a source under the data-quality rule. (Mirrors the dockets-record helper.)
const cleanUrl = (s: string | null | undefined): string | null => {
  const v = s?.trim()
  return v ? v : null
}

// Classify a hearing description into a known subtype so that ~30 filings all
// mentioning the same merits hearing collapse to one card.  Priority order:
// check prehearing first — a prehearing notice may mention the merits date in
// passing and would otherwise be mis-classified as "merits".
// Returns null when the description doesn't match any known subtype; callers
// must fall back to description-based keying (unknown subtypes are never merged).
function hearingSubtype(description: string): string | null {
  const d = description.toLowerCase()
  if (/pre[\s-]?hearing/.test(d))                   return "prehearing"
  if (/merits|evidentiary|five[\s-]day/.test(d))    return "merits"
  if (/status conf|scheduling conf/.test(d))         return "status_conf"
  if (/settlement/.test(d))                          return "settlement"
  if (/technical conf|workshop/.test(d))             return "technical"
  if (/oral argument/.test(d))                       return "oral_argument"
  if (/public participation|public hearing/.test(d)) return "public"
  return null
}

// Build a semantic dedup key for one deadline entry.
// For hearing-type entries (type="hearing" or type absent), attempt subtype
// classification.  If a known subtype is found, collapse by
// (docket, date, hearing, subtype).  If the subtype is unknown, fall back to
// the normalised description prefix so nothing is merged silently.
// For all other types, use (docket, date, type, description_prefix).
function deadlineDedupeKey(
  docketId: string,
  dl: { date: string | null; type?: string | null; description: string },
): string {
  const norm = dl.description.toLowerCase().replace(/\s+/g, " ").trim()
  if (dl.type === "hearing" || !dl.type) {
    const sub = hearingSubtype(dl.description)
    if (sub !== null) return `${docketId}:${dl.date}:hearing:${sub}`
  }
  return `${docketId}:${dl.date}:${dl.type ?? "other"}:${norm.slice(0, 80)}`
}

// ---------------------------------------------------------------------------
// getDeadlines — Zone 1
// Merges filing-attached deadlines (extractions JSONB) + market_events calendar.
// Scoped to tracked dockets ∩ entitled markets.
// ---------------------------------------------------------------------------

export async function getDeadlines(
  docketIds: string[],
  entitledJurisdictions: string[],
  today: string,
  limit = 100,
): Promise<DashboardDeadline[]> {
  if (docketIds.length === 0) return []

  const todayMs = new Date(today + "T00:00:00Z").getTime()
  const result: DashboardDeadline[] = []
  const seen = new Set<string>()

  // --- filing-attached deadlines ---
  // Fetch ALL extractions for tracked+entitled dockets — no filing-date window,
  // no per-docket cap.  Only filings that have an extraction row are returned
  // (innerJoin), so a quiet docket with one old filing containing a near-term
  // deadline is never evicted by a busy docket's recent filing volume.
  // The global cap is applied after dedup+sort, on the resulting deadlines.
  const rows = await db
    .select({
      docketId:         dockets.id,
      docketExternalId: dockets.externalId,
      docketTitle:      dockets.title,
      jurisdiction:     dockets.jurisdiction,
      sourceUrl:        filings.sourceUrl,
      filingExternalId: filings.externalId,
      payload:          extractions.payload,
    })
    .from(filings)
    .innerJoin(dockets, and(
      eq(dockets.id, filings.docketId),
      isNotNull(filings.docketId),
    ))
    .innerJoin(extractions, eq(extractions.filingId, filings.id))
    .where(
      and(
        inArray(filings.docketId, docketIds),
        entitledJurisdictions.length > 0
          ? inArray(dockets.jurisdiction, entitledJurisdictions)
          : sql`true`,
      )
    )

  // Docket-level source fallback (B1 parity): the first verifiable URL found
  // anywhere in a docket's extractions — a real filing source_url, else the FERC
  // accession filelist link (FERC filing external_ids ARE the accession), else a
  // non-broken deadline verify_url. The broken eLibrary ?q= search URLs are
  // skipped (they land on an empty SPA page). Lets a dated deadline lacking its
  // own URL still resolve to a verifiable source. P0: every row gets a link.
  const docketSource = new Map<string, string>()
  for (const row of rows) {
    if (docketSource.has(row.docketId)) continue
    const fromFiling = cleanUrl(row.sourceUrl) ?? fercAccessionUrl(row.filingExternalId)
    if (fromFiling) { docketSource.set(row.docketId, fromFiling); continue }
    for (const dl of row.payload?.deadlines ?? []) {
      const v = cleanUrl(dl.verify_url)
      if (v && !isBrokenFercSearchUrl(v)) { docketSource.set(row.docketId, v); break }
    }
  }

  // Semantic dedup: group entries by (docket, date, type, subtype) so many
  // filings all mentioning the same merits hearing collapse to one card.
  // Within each group: keep the longest description (most complete wording),
  // prefer confirmed (estimated=false) if any mention is confirmed.
  // _perRow holds the best per-row link (verify_url, else filing source_url),
  // resolved to a final verifyUrl (with docket-level fallback) after the loop.
  const dlGroups = new Map<string, DashboardDeadline & { _perRow: string | null }>()
  const dlDescLen = new Map<string, number>()

  for (const row of rows) {
    for (const dl of row.payload?.deadlines ?? []) {
      if (!dl.date || dl.date < today) continue
      const key = deadlineDedupeKey(row.docketId, dl)
      const daysRemaining = Math.ceil(
        (new Date(dl.date + "T12:00:00Z").getTime() - todayMs) / DAYS_MS
      )
      // FERC-aware: real verify_url (not the broken ?q= search) → filing
      // source_url → FERC accession filelist link (from the filing external_id).
      const perRow = bestSourceLink(dl.verify_url, row.sourceUrl, row.filingExternalId)
      const existing = dlGroups.get(key)
      if (!existing) {
        dlGroups.set(key, {
          docketId:         row.docketId,
          docketExternalId: row.docketExternalId,
          docketTitle:      row.docketTitle,
          jurisdiction:     row.jurisdiction,
          type:             dl.type ?? "other",
          description:      dl.description,
          date:             dl.date,
          estimated:        dl.estimated ?? true,
          verifyUrl:        null, // resolved after the loop
          _perRow:          perRow,
          daysRemaining,
          mentionCount:     1,
          kind:             "filing",
        })
        dlDescLen.set(key, dl.description.length)
      } else {
        existing.mentionCount++
        const prevLen = dlDescLen.get(key) ?? 0
        if (dl.description.length > prevLen) {
          existing.description = dl.description
          dlDescLen.set(key, dl.description.length)
        }
        if (!(dl.estimated ?? true)) existing.estimated = false
        // Prefer a real per-row verify_url (not the broken search URL); otherwise
        // keep the first usable link (filing source_url / FERC accession).
        const realVerify = cleanUrl(dl.verify_url)
        if (realVerify && !isBrokenFercSearchUrl(realVerify)) existing._perRow = realVerify
        else if (!existing._perRow && perRow) existing._perRow = perRow
      }
    }
  }

  // Resolve each deadline's link: its own source, else the docket-level source.
  // D2: never drop a row — fall through to docket-level link (null only when a
  // docket has no URL anywhere, which is rare and still beats hiding a deadline).
  for (const { _perRow, ...d } of dlGroups.values()) {
    result.push({ ...d, verifyUrl: _perRow ?? docketSource.get(d.docketId) ?? null })
  }

  // --- market_events calendar (services-owned table, raw SQL) ---
  // Only fetch for entitled jurisdictions; skip if none.
  if (entitledJurisdictions.length > 0) {
    try {
      // postgres-js passes JS arrays as PostgreSQL arrays natively
      const evtRows = await db.execute<{
        title: string
        event_date: string
        estimated: boolean
        jurisdiction: string
        related_docket: string | null
        source_url: string | null
      }>(sql`
        SELECT title, event_date::text, estimated, jurisdiction,
               related_docket, source_url
        FROM market_events
        WHERE event_date >= ${today}::date
          AND jurisdiction = ANY(${entitledJurisdictions})
        ORDER BY event_date
        LIMIT 50
      `)

      for (const evt of evtRows) {
        const key = `market_events:${evt.event_date}:${evt.title}`
        if (seen.has(key)) continue
        seen.add(key)
        const daysRemaining = Math.ceil(
          (new Date(evt.event_date + "T12:00:00Z").getTime() - todayMs) / DAYS_MS
        )
        result.push({
          docketId:         evt.related_docket ?? "market_event",
          docketExternalId: "",
          docketTitle:      null,
          jurisdiction:     evt.jurisdiction,
          type:             "calendar",
          description:      evt.title,
          date:             evt.event_date,
          // D5: market_events are authoritative calendar dates, not extractions
          // → always confirmed, regardless of the table's `estimated` column.
          estimated:        false,
          verifyUrl:        cleanUrl(evt.source_url),
          daysRemaining,
          mentionCount:     1,
          kind:             "market_event",
        })
      }
    } catch {
      // market_events table may not exist in all environments — degrade gracefully
    }
  }

  // B4: collapse with/without-hearing conditional variants (cross-date) to one
  // row before the final sort. market_events / ordinary deadlines pass through.
  const grouped = groupConditionalDeadlines(result, d => d.docketId)

  // Cap after global sort — keeps the strip bounded regardless of tracking breadth.
  return grouped.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, limit)
}

// ---------------------------------------------------------------------------
// getRecentFeed — Zone 2
// Recent filings (last 7 days), grouped by primary docket (matter).
// ---------------------------------------------------------------------------

// PUCT stores each submission as multiple files (typically ZIP + PDF) with
// consecutive document IDs under the same item number, e.g.:
//   59475_5876_1653802 (ZIP)  and  59475_5876_1653803 (PDF)
// This helper extracts the stable submission key "{docket}_{item}" from a
// 3-segment all-numeric external_id.  Returns null for any other format
// (FERC, ERCOT, CAISO, …) so they are never collapsed — scoped to PUCT only.
function puctSubmissionKey(externalId: string): string | null {
  const parts = externalId.split("_")
  if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
    return `${parts[0]}_${parts[1]}`
  }
  return null
}

export async function getRecentFeed(
  docketIds: string[],
  entitledJurisdictions: string[],
  today: string,
): Promise<FeedGroup[]> {
  if (docketIds.length === 0) return []

  const cutoff = new Date(new Date(today + "T00:00:00Z").getTime() - FEED_DAYS * DAYS_MS)

  const rows = await db
    .select({
      filingId:          filings.id,
      filingExternalId:  filings.externalId,
      filingTitle:       filings.title,
      docType:           filings.docType,
      filedAt:           filings.filedAt,
      sourceUrl:         filings.sourceUrl,
      payload:           extractions.payload,
      docketId:          dockets.id,
      docketExternalId:  dockets.externalId,
      docketTitle:       dockets.title,
      jurisdiction:      dockets.jurisdiction,
    })
    .from(filings)
    .innerJoin(dockets, and(
      eq(dockets.id, filings.docketId),
      isNotNull(filings.docketId),
    ))
    .leftJoin(extractions, eq(extractions.filingId, filings.id))
    .where(
      and(
        inArray(filings.docketId, docketIds),
        entitledJurisdictions.length > 0
          ? inArray(dockets.jurisdiction, entitledJurisdictions)
          : sql`true`,
        gte(filings.filedAt, cutoff),
      )
    )
    .orderBy(desc(filings.filedAt))
    .limit(200)

  // Submission-key dedup: collapse PUCT ZIP+PDF pairs to one FeedItem.
  // Prefer the row that has an extraction/summary; tiebreak → PDF source.
  // Non-PUCT external_ids (puctSubmissionKey returns null) use filingId as
  // the key and are never collapsed.
  // Brief-level dedup for the same pattern is already handled in services by
  // dedup_candidates() using metadata.item_key — no change needed there.
  const groups = new Map<string, FeedGroup>()
  // docketId → submKey → index in group.items (for in-place replacement)
  const submKeyIndex = new Map<string, Map<string, number>>()

  for (const r of rows) {
    if (!groups.has(r.docketId)) {
      groups.set(r.docketId, {
        docketId:         r.docketId,
        docketExternalId: r.docketExternalId,
        docketTitle:      r.docketTitle,
        jurisdiction:     r.jurisdiction,
        items:            [],
      })
      submKeyIndex.set(r.docketId, new Map())
    }

    const group    = groups.get(r.docketId)!
    const keyMap   = submKeyIndex.get(r.docketId)!
    const submKey  = puctSubmissionKey(r.filingExternalId) ?? r.filingId
    const hasSummary = r.payload?.summary != null
    const isPdf      = r.sourceUrl?.toLowerCase().endsWith(".pdf") ?? false

    const newItem: FeedItem = {
      filingId:         r.filingId,
      filingTitle:      r.filingTitle,
      docType:          r.docType,
      filedAt:          r.filedAt,
      sourceUrl:        r.sourceUrl,
      summary:          r.payload?.summary ?? null,
      docketId:         r.docketId,
      docketExternalId: r.docketExternalId,
      docketTitle:      r.docketTitle,
      jurisdiction:     r.jurisdiction,
    }

    const existingIdx = keyMap.get(submKey)
    if (existingIdx === undefined) {
      keyMap.set(submKey, group.items.length)
      group.items.push(newItem)
    } else {
      const existing = group.items[existingIdx]
      const existingHasSummary = existing.summary != null
      const existingIsPdf      = existing.sourceUrl?.toLowerCase().endsWith(".pdf") ?? false
      const newIsBetter =
        (hasSummary && !existingHasSummary) ||
        (hasSummary === existingHasSummary && isPdf && !existingIsPdf)
      if (newIsBetter) group.items[existingIdx] = newItem
    }
  }

  // Sort groups by most-recent filing first
  return [...groups.values()].sort(
    (a, b) => b.items[0].filedAt.getTime() - a.items[0].filedAt.getTime()
  )
}

// ---------------------------------------------------------------------------
// getMatterThreads — Zone 3
// One card per tracked docket, with: next deadline, parties, linked dockets.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getDashboardReadiness
// Detects whether a user's tracked dockets have any extractions yet.
// Used to distinguish "backfill in flight" (recently tracked, zero extractions)
// from "quiet market" (has extractions, just no recent activity).
// ---------------------------------------------------------------------------

export async function getDashboardReadiness(
  userId: string,
  docketIds: string[],
): Promise<{ hasExtractions: boolean; latestTrackAt: Date | null }> {
  if (docketIds.length === 0) return { hasExtractions: false, latestTrackAt: null }

  const [extractionRows, trackRows] = await Promise.all([
    db
      .select({ filingId: extractions.filingId })
      .from(extractions)
      .innerJoin(filings, eq(filings.id, extractions.filingId))
      .where(inArray(filings.docketId, docketIds))
      .limit(1),
    db
      .select({ latest: sql<string>`max(created_at)` })
      .from(userDockets)
      .where(and(
        eq(userDockets.userId, userId),
        inArray(userDockets.docketId, docketIds),
      )),
  ])

  return {
    hasExtractions: extractionRows.length > 0,
    latestTrackAt: trackRows[0]?.latest ? new Date(trackRows[0].latest) : null,
  }
}

export async function getMatterThreads(
  docketIds: string[],
  entitledJurisdictions: string[],
  deadlines: DashboardDeadline[],
): Promise<MatterThread[]> {
  if (docketIds.length === 0) return []

  const docketRows = await db
    .select({
      id:           dockets.id,
      externalId:   dockets.externalId,
      title:        dockets.title,
      jurisdiction: dockets.jurisdiction,
      status:       dockets.status,
    })
    .from(dockets)
    .where(
      and(
        inArray(dockets.id, docketIds),
        entitledJurisdictions.length > 0
          ? inArray(dockets.jurisdiction, entitledJurisdictions)
          : sql`true`,
      )
    )

  // Collect parties from recent filings (last 10 per docket)
  const partiesMap = new Map<string, Set<string>>()
  if (docketRows.length > 0) {
    const filteredIds = docketRows.map(d => d.id)
    const recentRows = await db
      .select({ docketId: filings.docketId, payload: extractions.payload })
      .from(filings)
      .leftJoin(extractions, eq(extractions.filingId, filings.id))
      .where(and(
        inArray(filings.docketId, filteredIds),
        isNotNull(filings.docketId),
      ))
      .orderBy(desc(filings.filedAt))
      .limit(300)

    for (const r of recentRows) {
      if (!r.docketId) continue
      if (!partiesMap.has(r.docketId)) partiesMap.set(r.docketId, new Set())
      for (const p of r.payload?.parties ?? []) partiesMap.get(r.docketId)!.add(p)
    }
  }

  // Linked dockets via filing_dockets junction (cross-jurisdiction).
  // Two-step Drizzle query — avoids sql.raw() which breaks with postgres-js driver.
  // Step 1: filing IDs where a tracked docket is the primary.
  // Step 2: other dockets linked to those filings.
  const linkedMap = new Map<string, LinkedDocket[]>()
  if (docketRows.length > 0) {
    const filteredIds = docketRows.map(d => d.id)

    const primaryFds = await db
      .select({ filingId: filingDockets.filingId, docketId: filingDockets.docketId })
      .from(filingDockets)
      .where(and(
        inArray(filingDockets.docketId, filteredIds),
        eq(filingDockets.isPrimary, true),
      ))
      .limit(200)

    if (primaryFds.length > 0) {
      const primaryFilingIds = [...new Set(primaryFds.map(r => r.filingId))]
      const linkedFds = await db
        .select({
          filingId:    filingDockets.filingId,
          linkedId:    dockets.id,
          externalId:  dockets.externalId,
          title:       dockets.title,
          jurisdiction: dockets.jurisdiction,
        })
        .from(filingDockets)
        .innerJoin(dockets, eq(dockets.id, filingDockets.docketId))
        .where(and(
          inArray(filingDockets.filingId, primaryFilingIds),
          notInArray(filingDockets.docketId, filteredIds),
        ))
        .limit(100)

      // Map filing → primary docket to build primaryDocketId → linkedDockets
      const filingToPrimary = new Map(primaryFds.map(r => [r.filingId, r.docketId]))
      for (const row of linkedFds) {
        const primaryId = filingToPrimary.get(row.filingId)
        if (!primaryId) continue
        if (!linkedMap.has(primaryId)) linkedMap.set(primaryId, [])
        const existing = linkedMap.get(primaryId)!
        if (!existing.find(d => d.externalId === row.externalId)) {
          existing.push({
            id:           row.linkedId,
            externalId:   row.externalId,
            title:        row.title,
            jurisdiction: row.jurisdiction,
          })
        }
      }
    }
  }

  // Index deadlines by docket (first = soonest)
  const deadlinesByDocket = new Map<string, DashboardDeadline>()
  for (const dl of deadlines) {
    if (dl.docketId !== "market_event" && !deadlinesByDocket.has(dl.docketId)) {
      deadlinesByDocket.set(dl.docketId, dl)
    }
  }

  return docketRows.map(d => ({
    docketId:      d.id,
    externalId:    d.externalId,
    title:         d.title,
    jurisdiction:  d.jurisdiction,
    status:        d.status,
    nextDeadline:  deadlinesByDocket.get(d.id) ?? null,
    parties:       [...(partiesMap.get(d.id) ?? [])].slice(0, 8),
    linkedDockets: linkedMap.get(d.id) ?? [],
  }))
}

// ---------------------------------------------------------------------------
// getDiscoveryHits — rolling 30-day entity mention feed (#85)
// Queries discovery_feed (services-owned table) ILIKE-matched against the
// user's watched_entities. Same gate-logic as compose_brief: description +
// filer_names. Returns [] silently on any DB error.
// ---------------------------------------------------------------------------

export interface DiscoveryHit {
  accession: string
  description: string
  filerNames: string[]
  docketNumbers: string[]
  filedAt: string
  docType: string
}

// ---------------------------------------------------------------------------
// getSalienceItems — market highlights this week (#128)
// Reads market_salience (services-owned table) for markets the user can access.
// Returns rows above SURFACE_FLOOR ordered by market, rank.
// ---------------------------------------------------------------------------

export interface SalienceItem {
  market: string
  rank: number
  docketKey: string
  docketTitle: string | null
  score: number
  headline: string | null
}

const SALIENCE_SURFACE_FLOOR = 50

const _MARKET_ACCESS_TO_SAL_MARKETS: Record<string, string[]> = {
  PUCT:  ["PUCT"],
  ERCOT: ["ERCOT"],
  CAISO: ["CAISO", "FERC"],
  PJM:   ["PJM", "FERC"],
}

export async function getSalienceItems(
  marketAccess: string[],
): Promise<SalienceItem[]> {
  const salMarkets = new Set<string>()
  for (const m of marketAccess) {
    for (const sm of _MARKET_ACCESS_TO_SAL_MARKETS[m] ?? []) salMarkets.add(sm)
  }
  const markets = [...salMarkets]
  if (markets.length === 0) return []

  // postgres-js expands JS arrays as tuples ($1,$2,...) not PG arrays, so
  // ANY(${arr}) generates invalid SQL — use IN (${sql.join(...)}) instead.
  const mkList = () => sql.join(markets.map(m => sql`${m}`), sql`, `)

  try {
    const rows = await db.execute<{
      market:       string
      rank:         number
      docket_key:   string
      docket_title: string | null
      score:        string
      headline:     string | null
    }>(sql`
      SELECT market, rank, docket_key, docket_title, score::float, headline
      FROM market_salience ms
      WHERE market IN (${mkList()})
        AND week_start = (
          SELECT MAX(week_start) FROM market_salience
          WHERE market = ms.market
            AND week_start >= (CURRENT_DATE - INTERVAL '14 days')::date
        )
        AND score >= ${SALIENCE_SURFACE_FLOOR}
      ORDER BY market, rank
    `)
    return rows.map(r => ({
      market:      r.market,
      rank:        r.rank,
      docketKey:   r.docket_key,
      docketTitle: r.docket_title ?? null,
      score:       Number(r.score),
      headline:    r.headline ?? null,
    }))
  } catch {
    return []
  }
}

export async function getDiscoveryHits(
  userId: string,
): Promise<{ hits: DiscoveryHit[]; hasEntities: boolean }> {
  const entityRows = await db
    .select({ name: watchedEntities.name, aliases: watchedEntities.aliases })
    .from(watchedEntities)
    .where(eq(watchedEntities.userId, userId))

  if (entityRows.length === 0) return { hits: [], hasEntities: false }

  const patterns: string[] = []
  for (const row of entityRows) {
    patterns.push(`%${row.name}%`)
    for (const alias of (row.aliases ?? [])) {
      const a = alias.trim()
      if (a) patterns.push(`%${a}%`)
    }
  }
  if (patterns.length === 0) return { hits: [], hasEntities: false }

  const sinceStr = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)

  try {
    // Build conditions with sql.join() — avoids deeply-nested SQL objects from reduce()
    // which can misfire with postgres-js parameterization. ILIKE ANY(array) also skipped
    // (postgres-js doesn't reliably encode JS string[] as pg text[] in all driver versions).
    const descConds  = patterns.map(p => sql`description ILIKE ${p}`)
    const filerConds = patterns.map(p => sql`EXISTS (SELECT 1 FROM unnest(filer_names) AS fn WHERE fn ILIKE ${p})`)
    const matchExpr  = sql.join([...descConds, ...filerConds], sql` OR `)

    const rows = await db.execute<{
      accession:      string
      description:    string
      filer_names:    string[] | null
      docket_numbers: string[] | null
      filed_at:       string
      doc_type:       string
    }>(sql`
      SELECT accession, description, filer_names, docket_numbers,
             filed_at::text, doc_type
      FROM discovery_feed
      WHERE expires_at > NOW()
        AND filed_at >= ${sinceStr}::date
        AND (${matchExpr})
      ORDER BY filed_at DESC
      LIMIT 30
    `)

    return {
      hits: rows.map(r => ({
        accession:     r.accession,
        description:   r.description,
        filerNames:    r.filer_names ?? [],
        docketNumbers: r.docket_numbers ?? [],
        filedAt:       (r.filed_at ?? "").slice(0, 10),
        docType:       r.doc_type,
      })),
      hasEntities: true,
    }
  } catch {
    return { hits: [], hasEntities: true }
  }
}
