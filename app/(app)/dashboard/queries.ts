import { db } from "@/db/client"
import {
  userDockets,
  dockets,
  filings,
  extractions,
  teamMemberships,
} from "@/db/schema"
import { and, eq, inArray, desc, gte, sql, isNotNull } from "drizzle-orm"

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
  CAISO: ["CAISO-FERC", "CAISO", "CPUC"],
  PJM:   ["PJM-FERC", "PJM"],
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
// getDeadlines — Zone 1
// Merges filing-attached deadlines (extractions JSONB) + market_events calendar.
// Scoped to tracked dockets ∩ entitled markets.
// ---------------------------------------------------------------------------

export async function getDeadlines(
  docketIds: string[],
  entitledJurisdictions: string[],
  today: string,
): Promise<DashboardDeadline[]> {
  if (docketIds.length === 0) return []

  const todayMs = new Date(today + "T00:00:00Z").getTime()
  const result: DashboardDeadline[] = []
  const seen = new Set<string>()

  // --- filing-attached deadlines ---
  const rows = await db
    .select({
      docketId:         dockets.id,
      docketExternalId: dockets.externalId,
      docketTitle:      dockets.title,
      jurisdiction:     dockets.jurisdiction,
      payload:          extractions.payload,
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
      )
    )
    .orderBy(desc(filings.filedAt))
    .limit(600)

  for (const row of rows) {
    for (const dl of row.payload?.deadlines ?? []) {
      if (!dl.date || dl.date < today) continue
      const key = `${row.docketId}:${dl.date}:${dl.description}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        docketId:         row.docketId,
        docketExternalId: row.docketExternalId,
        docketTitle:      row.docketTitle,
        jurisdiction:     row.jurisdiction,
        type:             dl.type ?? "other",
        description:      dl.description,
        date:             dl.date,
        estimated:        dl.estimated ?? true,
        verifyUrl:        dl.verify_url ?? null,
        daysRemaining:    Math.ceil((new Date(dl.date + "T12:00:00Z").getTime() - todayMs) / DAYS_MS),
      })
    }
  }

  // --- market_events calendar (services-owned table, raw SQL) ---
  // Only fetch for entitled jurisdictions; skip if none.
  if (entitledJurisdictions.length > 0) {
    try {
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
          AND jurisdiction = ANY(${sql.raw(`ARRAY[${entitledJurisdictions.map(j => `'${j}'`).join(",")}]`)})
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
          estimated:        evt.estimated,
          verifyUrl:        evt.source_url ?? null,
          daysRemaining,
        })
      }
    } catch {
      // market_events table may not exist in all environments — degrade gracefully
    }
  }

  return result.sort((a, b) => a.daysRemaining - b.daysRemaining)
}

// ---------------------------------------------------------------------------
// getRecentFeed — Zone 2
// Recent filings (last 7 days), grouped by primary docket (matter).
// ---------------------------------------------------------------------------

export async function getRecentFeed(
  docketIds: string[],
  entitledJurisdictions: string[],
  today: string,
): Promise<FeedGroup[]> {
  if (docketIds.length === 0) return []

  const cutoff = new Date(new Date(today + "T00:00:00Z").getTime() - FEED_DAYS * DAYS_MS)

  const rows = await db
    .select({
      filingId:         filings.id,
      filingTitle:      filings.title,
      docType:          filings.docType,
      filedAt:          filings.filedAt,
      sourceUrl:        filings.sourceUrl,
      payload:          extractions.payload,
      docketId:         dockets.id,
      docketExternalId: dockets.externalId,
      docketTitle:      dockets.title,
      jurisdiction:     dockets.jurisdiction,
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

  const groups = new Map<string, FeedGroup>()
  for (const r of rows) {
    if (!groups.has(r.docketId)) {
      groups.set(r.docketId, {
        docketId:         r.docketId,
        docketExternalId: r.docketExternalId,
        docketTitle:      r.docketTitle,
        jurisdiction:     r.jurisdiction,
        items:            [],
      })
    }
    groups.get(r.docketId)!.items.push({
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
    })
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

  // Linked dockets via filing_dockets junction (cross-jurisdiction)
  // Find all dockets that share a filing with our tracked dockets, where ours is primary.
  const linkedMap = new Map<string, LinkedDocket[]>()
  if (docketRows.length > 0) {
    const filteredIds = docketRows.map(d => d.id)
    const crossRefs = await db.execute<{
      primary_docket_id: string
      linked_id: string
      linked_external_id: string
      linked_title: string | null
      linked_jurisdiction: string | null
    }>(sql`
      SELECT
        fd_primary.docket_id   AS primary_docket_id,
        d_linked.id            AS linked_id,
        d_linked.external_id   AS linked_external_id,
        d_linked.title         AS linked_title,
        d_linked.jurisdiction  AS linked_jurisdiction
      FROM filing_dockets fd_primary
      JOIN filing_dockets fd_linked
        ON fd_linked.filing_id = fd_primary.filing_id
        AND fd_linked.docket_id != fd_primary.docket_id
      JOIN dockets d_linked ON d_linked.id = fd_linked.docket_id
      WHERE fd_primary.docket_id = ANY(${sql.raw(`ARRAY[${filteredIds.map(id => `'${id}'`).join(",")}]`)})
        AND fd_primary.is_primary = true
    LIMIT 100
    `)

    for (const row of crossRefs) {
      if (!linkedMap.has(row.primary_docket_id)) linkedMap.set(row.primary_docket_id, [])
      const existing = linkedMap.get(row.primary_docket_id)!
      if (!existing.find(d => d.id === row.linked_id)) {
        existing.push({
          id:           row.linked_id,
          externalId:   row.linked_external_id,
          title:        row.linked_title,
          jurisdiction: row.linked_jurisdiction,
        })
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
