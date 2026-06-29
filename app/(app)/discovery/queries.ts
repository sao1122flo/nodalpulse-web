import { db } from "@/db/client"
import { watchedThemes } from "@/db/schema"
import { eq, sql } from "drizzle-orm"
import { fercAccessionUrl } from "@/lib/ferc-links"

export interface Theme {
  key:        string
  label:      string
  definition: string
}

export interface DiscoveryThemeMatch {
  key:      string
  label:    string
  evidence: string | null
}

export interface DiscoveryFeedItem {
  accession:     string
  description:   string
  docType:       string
  docketNumbers: string[]
  filedAt:       string   // YYYY-MM-DD
  daysAgo:       number
  sourceUrl:     string | null
  themes:        DiscoveryThemeMatch[]
}

// Curated theme taxonomy (services-owned `themes`; read-only here).
export async function getThemes(): Promise<Theme[]> {
  try {
    const rows = await db.execute<{ key: string; label: string; definition: string }>(sql`
      SELECT key, label, definition FROM themes WHERE active ORDER BY sort_order
    `)
    return rows.map(r => ({ key: r.key, label: r.label, definition: r.definition }))
  } catch {
    return []
  }
}

export async function getWatchedThemeKeys(userId: string): Promise<string[]> {
  const rows = await db
    .select({ k: watchedThemes.themeKey })
    .from(watchedThemes)
    .where(eq(watchedThemes.userId, userId))
  return rows.map(r => r.k)
}

// The discovery feed: FERC matters matching the user's subscribed themes,
// EXCLUDING dockets the user already tracks (→ monitoring, not discovery) and
// items the user dismissed. Theme-classified once globally (discovery_matches);
// per-user filtering happens here. Source link is the FERC accession file list.
export async function getDiscoveryThemeFeed(
  userId: string,
  subscribedKeys: string[],
  sinceDays = 30,
): Promise<DiscoveryFeedItem[]> {
  if (subscribedKeys.length === 0) return []

  // postgres-js doesn't reliably encode JS string[] as pg text[]; use an IN list.
  const keyList = sql.join(subscribedKeys.map(k => sql`${k}`), sql`, `)

  try {
    const rows = await db.execute<{
      accession:      string
      description:    string
      doc_type:       string
      docket_numbers: string[] | null
      filed_at:       string
      themes:         { key: string; label: string; evidence: string | null }[] | null
    }>(sql`
      SELECT df.accession, df.description, df.doc_type, df.docket_numbers,
             df.filed_at::text AS filed_at,
             json_agg(
               json_build_object('key', t.key, 'label', t.label, 'evidence', dm.evidence_snippet)
               ORDER BY t.sort_order
             ) AS themes
      FROM discovery_feed df
      JOIN discovery_matches dm ON dm.discovery_id = df.id
      JOIN themes t            ON t.id = dm.theme_id
      WHERE df.expires_at > NOW()
        AND df.filed_at >= (CURRENT_DATE - ${sinceDays}::int)
        AND t.key IN (${keyList})
        AND NOT EXISTS (
            SELECT 1 FROM user_dockets ud
            JOIN dockets d ON d.id = ud.docket_id
            WHERE ud.user_id = ${userId}::uuid
              AND d.external_id = ANY(df.docket_numbers)
        )
        AND NOT EXISTS (
            SELECT 1 FROM extraction_feedback ef
            WHERE ef.user_id = ${userId}::uuid
              AND ef.item_type = 'discovery'
              AND ef.hides_item
              AND ef.item_ref = df.accession
        )
      GROUP BY df.id, df.accession, df.description, df.doc_type, df.docket_numbers, df.filed_at
      ORDER BY df.filed_at DESC
      LIMIT 150
    `)

    const now = Date.now()
    return rows.map(r => {
      const filedAt = (r.filed_at ?? "").slice(0, 10)
      const daysAgo = filedAt
        ? Math.max(0, Math.floor((now - new Date(filedAt + "T12:00:00Z").getTime()) / 86_400_000))
        : 0
      return {
        accession:     r.accession,
        description:   r.description,
        docType:       r.doc_type,
        docketNumbers: r.docket_numbers ?? [],
        filedAt,
        daysAgo,
        sourceUrl:     fercAccessionUrl(r.accession),
        themes:        (r.themes ?? []).filter(x => x && x.key),
      }
    })
  } catch {
    return []
  }
}
