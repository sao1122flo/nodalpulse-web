// MCP tool server for the NodalPulse connector (WS-A + WS-C).
//
// Route is a dynamic [transport] segment (mcp-handler requirement): a request to
// /api/mcp resolves transport="mcp" (stateless Streamable HTTP — our path, no Redis).
// The PUBLIC url stays /api/mcp, which lib/auth.ts advertises as the RFC 8707 `resource`.
//
// Auth: withMcpAuth validates the bearer access token (401 on bad/missing) and hands
// us a non-null OAuthAccessToken whose `userId` is the clean user id every tool scopes to.
// Tools are registered per-request so they close over that userId.
//
// Trust discipline (CONNECTOR-MCP-FASE2.md §3): every tool description states exactly
// what it returns and its real scope limits; every result carries source links. All
// WS-C tools are READ-ONLY and unmetered — guarded only by a light per-user read rate
// limiter (checkReadRate), NOT the AI action quota.
import { auth } from "@/lib/auth"
import { withMcpAuth } from "better-auth/plugins"
import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { watchedEntities } from "@/db/schema"
import { getEntitlements } from "@/lib/entitlements"
import { fercAccessionUrl } from "@/lib/ferc-links"
import { checkReadRate } from "@/lib/mcp-rate-limit"
import { askTheRecord } from "@/lib/services-client"
import {
  resolveDocket,
  getDocketMeta,
  getDocketAssemblyState,
  getDocketFilingsPage,
  isDocketTracked,
} from "@/app/(app)/dockets/[docketNumber]/queries"
import {
  getDeadlines,
  getTrackedDocketIds,
  jurisdictionsForMarkets,
  getDiscoveryHits,
} from "@/app/(app)/dashboard/queries"
import { getThemes, getDiscoveryThemeFeed } from "@/app/(app)/discovery/queries"

const LATEST_FILINGS = 10

const text = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload) }],
})

// Read-tool guardrail. Returns a text() response to short-circuit with, or null if OK.
function rateLimited(userId: string) {
  const r = checkReadRate(userId)
  if (r.ok) return null
  return text({
    rate_limited: true,
    retry_after_seconds: r.retryAfterSec,
    message: `Too many requests. Try again in ~${r.retryAfterSec}s. (Read rate limit — not your AI quota.)`,
  })
}

// Today in America/Chicago (the market timezone the app uses for deadline math).
function todayChicago(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) // YYYY-MM-DD
}

function buildHandler(userId: string) {
  return createMcpHandler(
    (server) => {
      // -----------------------------------------------------------------------
      // check_docket (WS-A)
      // -----------------------------------------------------------------------
      server.registerTool(
        "check_docket",
        {
          title: "Check a docket",
          description:
            "Status, metadata, and the latest filings for a regulatory docket, from the user's verified NodalPulse Record. This is the public regulatory record (PUCT / FERC / CAISO / PJM …), gated to what the user is entitled to see (a docket they track, or a market they have access to). Every filing carries a source link. Does NOT search the web or rely on model memory — if it isn't in the Record, it isn't returned.",
          inputSchema: {
            docket_id: z
              .string()
              .describe('Docket / proceeding number, e.g. "56765" (PUCT) or "ER24-1234" (FERC).'),
          },
        },
        async ({ docket_id }: { docket_id: string }) => {
          const limited = rateLimited(userId)
          if (limited) return limited

          const header = await resolveDocket(docket_id.trim())
          if (!header) {
            return text({ found: false, message: `No docket "${docket_id}" in the NodalPulse Record.` })
          }

          const ents = await getEntitlements(userId)
          const allowed =
            (await isDocketTracked(userId, header.id)) ||
            ents.marketAccess.includes(header.jurisdiction ?? "")
          if (!allowed) {
            return text({
              found: true,
              allowed: false,
              docket: { number: header.externalId, jurisdiction: header.jurisdiction },
              message:
                "This docket is outside your tracked dockets and entitled markets. Track it in NodalPulse to access it here.",
            })
          }

          const [meta, state, filings] = await Promise.all([
            getDocketMeta(header.id),
            getDocketAssemblyState(header.id, header.externalId),
            getDocketFilingsPage(header.id, LATEST_FILINGS),
          ])

          return text({
            found: true,
            allowed: true,
            docket: {
              number:       header.externalId,
              title:        header.title,
              jurisdiction: header.jurisdiction,
              status:       header.status,
              opened_at:    header.openedAt,
            },
            record_state:   state.state, // normal | partial | assembling | no-filings-yet
            filings_total:  meta.filingCount,
            first_filed_at: meta.firstFiledAt,
            last_filed_at:  meta.lastFiledAt,
            latest_filings: filings.map((f) => ({
              date:       f.filedAt,
              type:       f.docType,
              title:      f.title,
              filer:      f.filer,
              summary:    f.summary,
              source_url: f.sourceUrl,
            })),
            note:
              state.state === "no-filings-yet"
                ? "This docket is tracked but no filings have landed yet."
                : state.state === "assembling"
                  ? "This docket is being assembled — a crawl is in flight."
                  : `Showing the latest ${Math.min(LATEST_FILINGS, meta.filingCount)} of ${meta.filingCount} filings.`,
          })
        },
      )

      // -----------------------------------------------------------------------
      // list_watched_entities (WS-C) — trivial, user-scoped
      // -----------------------------------------------------------------------
      server.registerTool(
        "list_watched_entities",
        {
          title: "List watched entities",
          description:
            "The user's own watched-entity list in NodalPulse (companies / parties they monitor). Use this to know what get_mentions is scanning for. Returns each entity name and its aliases.",
          inputSchema: {},
        },
        async () => {
          const limited = rateLimited(userId)
          if (limited) return limited

          const rows = await db
            .select({ name: watchedEntities.name, aliases: watchedEntities.aliases })
            .from(watchedEntities)
            .where(eq(watchedEntities.userId, userId))

          return text({
            count: rows.length,
            entities: rows.map((r) => ({ name: r.name, aliases: r.aliases ?? [] })),
            note:
              rows.length === 0
                ? "No watched entities yet. Add some in NodalPulse to power get_mentions."
                : undefined,
          })
        },
      )

      // -----------------------------------------------------------------------
      // list_deadlines (WS-C) — extracted deadlines with source links
      // -----------------------------------------------------------------------
      server.registerTool(
        "list_deadlines",
        {
          title: "List upcoming deadlines",
          description:
            "Upcoming regulatory deadlines extracted from the user's tracked dockets — hearings, comment/protest windows, compliance and effective dates. Scoped to dockets the user tracks (optionally narrowed to one docket or one market). Every deadline carries a source link; each is marked confirmed vs estimated (absent-date treated as estimated, never shown as confirmed). Only extraction-derived deadlines that have a verifiable source are returned.",
          inputSchema: {
            docket_id: z
              .string()
              .optional()
              .describe('Optional: limit to a single docket you track, e.g. "56765".'),
            market: z
              .enum(["PUCT", "ERCOT", "CAISO", "PJM"])
              .optional()
              .describe("Optional: limit to one market (over your tracked dockets)."),
          },
        },
        async ({ docket_id, market }: { docket_id?: string; market?: string }) => {
          const limited = rateLimited(userId)
          if (limited) return limited

          const today = todayChicago()
          let docketIds: string[]
          let entitledJurisdictions: string[]

          if (docket_id) {
            const header = await resolveDocket(docket_id.trim())
            if (!header) return text({ scope: docket_id, count: 0, deadlines: [], message: "Docket not in the Record." })
            const ents = await getEntitlements(userId)
            const allowed =
              (await isDocketTracked(userId, header.id)) ||
              ents.marketAccess.includes(header.jurisdiction ?? "")
            if (!allowed) {
              return text({ scope: docket_id, allowed: false, message: "Not in your tracked dockets / entitled markets." })
            }
            docketIds = [header.id]
            entitledJurisdictions = [] // single explicit docket — no extra jurisdiction filter
          } else {
            docketIds = await getTrackedDocketIds(userId, false)
            if (docketIds.length === 0) {
              return text({ scope: "tracked", count: 0, deadlines: [], message: "You aren't tracking any dockets yet." })
            }
            entitledJurisdictions = market ? jurisdictionsForMarkets([market]) : []
          }

          const deadlines = await getDeadlines(docketIds, entitledJurisdictions, today)
          return text({
            scope: docket_id ?? market ?? "all-tracked",
            as_of: today,
            count: deadlines.length,
            deadlines: deadlines.map((d) => ({
              docket:         d.docketExternalId,
              jurisdiction:   d.jurisdiction,
              type:           d.type,
              description:    d.description,
              date:           d.date,
              days_remaining: d.daysRemaining,
              confirmed:      !d.estimated,        // estimated=true → not confirmed
              estimated:      d.estimated,
              mentions:       d.mentionCount,
              conditional:    d.conditional ?? null,
              kind:           d.kind,              // filing | market_event
              source_url:     d.verifyUrl,
            })),
          })
        },
      )

      // -----------------------------------------------------------------------
      // get_mentions (WS-C) — FERC discovery firehose, watched-entity ILIKE match
      // -----------------------------------------------------------------------
      server.registerTool(
        "get_mentions",
        {
          title: "Get recent mentions of your watched entities",
          description:
            "Recent mentions of the user's watched entities in the FERC discovery firehose only — an ILIKE (substring) match on filing descriptions and filer names, within a ~30-day TTL window. This is NOT all mentions across every market or every tracked docket; it is the FERC discovery feed. Every hit carries a FERC source link. Use list_watched_entities to see what's being matched.",
          inputSchema: {
            since_days: z
              .number()
              .int()
              .min(1)
              .max(60)
              .optional()
              .describe("Lookback window in days (default 30, max 60; bounded by the ~30-day feed TTL)."),
          },
        },
        async ({ since_days }: { since_days?: number }) => {
          const limited = rateLimited(userId)
          if (limited) return limited

          const { hits, hasEntities } = await getDiscoveryHits(userId, since_days ?? 30)
          if (!hasEntities) {
            return text({ count: 0, hits: [], message: "No watched entities yet — add some to get mentions." })
          }
          return text({
            window_days: since_days ?? 30,
            scope: "FERC discovery firehose (ILIKE on your watched entities)",
            count: hits.length,
            hits: hits.map((h) => ({
              filed_at:       h.filedAt,
              doc_type:       h.docType,
              description:    h.description,
              filers:         h.filerNames,
              docket_numbers: h.docketNumbers,
              source_url:     fercAccessionUrl(h.accession),
            })),
          })
        },
      )

      // -----------------------------------------------------------------------
      // discover_by_theme (WS-C) — FERC-only, untracked matters, precomputed themes
      // -----------------------------------------------------------------------
      server.registerTool(
        "discover_by_theme",
        {
          title: "Discover FERC matters by theme",
          description:
            "Discover regulatory matters matching a curated theme (FERC-only in v1) that the user does NOT already track — a discovery surface, not monitoring. Backed by precomputed theme classification over the FERC discovery feed. Every result carries a FERC source link. Call with no theme to list the available theme keys and labels first.",
          inputSchema: {
            theme: z
              .string()
              .optional()
              .describe("A theme key (from the no-argument listing). Omit to list available themes."),
            since_days: z
              .number()
              .int()
              .min(1)
              .max(90)
              .optional()
              .describe("Lookback window in days (default 30)."),
          },
        },
        async ({ theme, since_days }: { theme?: string; since_days?: number }) => {
          const limited = rateLimited(userId)
          if (limited) return limited

          const themes = await getThemes()
          if (!theme) {
            return text({
              available_themes: themes.map((t) => ({ key: t.key, label: t.label, definition: t.definition })),
              message: "Call discover_by_theme again with one of these `key` values.",
            })
          }
          const match = themes.find((t) => t.key === theme || t.label.toLowerCase() === theme.toLowerCase())
          if (!match) {
            return text({
              found: false,
              requested: theme,
              available_themes: themes.map((t) => ({ key: t.key, label: t.label })),
              message: "Unknown theme. Use one of the listed `key` values.",
            })
          }

          const items = await getDiscoveryThemeFeed(userId, [match.key], since_days ?? 30)
          return text({
            theme: { key: match.key, label: match.label },
            scope: "FERC-only, matters you do NOT already track",
            window_days: since_days ?? 30,
            count: items.length,
            matters: items.map((i) => ({
              filed_at:       i.filedAt,
              days_ago:       i.daysAgo,
              doc_type:       i.docType,
              description:    i.description,
              docket_numbers: i.docketNumbers,
              themes:         i.themes.map((t) => t.label),
              source_url:     i.sourceUrl,
            })),
          })
        },
      )

      // -----------------------------------------------------------------------
      // ask_the_record (WS-D) — the killer tool. Metered AI action (NOT rate-limited
      // by the read limiter). Grounded on ONE docket the user tracks; always cited.
      // -----------------------------------------------------------------------
      server.registerTool(
        "ask_the_record",
        {
          title: "Ask the Record",
          description:
            "Ask a natural-language question about a specific docket the user TRACKS, answered ONLY from their verified NodalPulse Record, with citations (source links). v1 scope: grounded over structured extraction summaries of the docket's recent filings (last ~30 days, up to 15 filings) — NOT full document text. If the answer isn't in those filings it says so rather than guessing. This is a metered AI action: it counts against the user's daily AI quota (shared with in-app Q&A).",
          inputSchema: {
            docket_id: z.string().describe('A docket the user tracks, e.g. "58481".'),
            question: z.string().describe("The question to answer from this docket's Record."),
          },
        },
        async ({ docket_id, question }: { docket_id: string; question: string }) => {
          // No read-limiter here — this is a metered AI action (services enforces the quota).
          const header = await resolveDocket(docket_id.trim())
          if (!header) {
            return text({ found: false, message: `No docket "${docket_id}" in the NodalPulse Record.` })
          }
          // ask_the_record requires TRACKING (stricter than the read tools' tracked-OR-entitled).
          if (!(await isDocketTracked(userId, header.id))) {
            return text({
              allowed: false,
              docket: { number: header.externalId },
              message: "Ask the Record only answers over dockets you track. Track this docket in NodalPulse first.",
            })
          }
          const ents = await getEntitlements(userId)
          const limitPerDay = ents.qa.limitPerDay ?? 0
          if (limitPerDay === 0) {
            return text({
              available: false,
              message: "Ask the Record isn't available on your current plan. Upgrade at nodalpulse.com/pricing.",
            })
          }

          const res = await askTheRecord({
            user_id: userId,
            docket_id: header.id,
            question,
            limit_per_day: limitPerDay,
          })

          if (!res.ok) {
            const e = res.error
            if (e.kind === "unexpected" && e.status === 429) {
              let resetsAt: string | undefined
              try { resetsAt = JSON.parse(e.body ?? "{}").resets_at } catch { /* ignore */ }
              return text({
                rate_limited: true,
                limit_per_day: limitPerDay,
                message: `You've reached your daily AI limit (${limitPerDay}).${resetsAt ? ` Resets ${resetsAt}.` : ""} Upgrade for more at nodalpulse.com/pricing.`,
              })
            }
            return text({ error: true, message: "Ask the Record is temporarily unavailable. Please try again." })
          }

          const v = res.value
          return text({
            docket: { number: header.externalId, jurisdiction: header.jurisdiction },
            question,
            answer: v.answer,
            citations: v.citations.map((c) => ({
              title:      c.title,
              docket:     c.docket_number,
              source_url: c.source_url,
              note:       c.relevance_note,
              snippet:    c.snippet,
            })),
            ai_actions_used_today:    v.used_today,
            ai_actions_limit_per_day: v.limit_per_day,
            scope_note:
              "Grounded on structured extraction summaries of this docket's recent filings (last ~30 days, up to 15) — not full document text.",
          })
        },
      )
    },
    {},
    { basePath: "/api", maxDuration: 60, verboseLogs: false },
  )
}

const handler = withMcpAuth(auth, (req, session) => buildHandler(session.userId)(req))

export { handler as GET, handler as POST }
