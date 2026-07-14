// MCP tool server for the NodalPulse connector (WS-A).
//
// Route is a dynamic [transport] segment (mcp-handler requirement): a request to
// /api/mcp resolves transport="mcp" (stateless Streamable HTTP — our path, no Redis);
// /api/sse would resolve the SSE transport. The PUBLIC url stays /api/mcp, which is
// what lib/auth.ts advertises as the RFC 8707 `resource`.
//
// Auth: withMcpAuth validates the bearer access token (401 on bad/missing) and hands
// us a non-null OAuthAccessToken whose `userId` is the clean user id every tool scopes to.
// Tools are registered per-request so they close over that userId.
//
// Trust discipline (see CONNECTOR-MCP-FASE2.md §3): every tool description states
// exactly what it returns and every result carries source links. Read-only.
import { auth } from "@/lib/auth"
import { withMcpAuth } from "better-auth/plugins"
import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { getEntitlements } from "@/lib/entitlements"
import {
  resolveDocket,
  getDocketMeta,
  getDocketAssemblyState,
  getDocketFilingsPage,
  isDocketTracked,
} from "@/app/(app)/dockets/[docketNumber]/queries"

const LATEST_FILINGS = 10

const text = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload) }],
})

function buildHandler(userId: string) {
  return createMcpHandler(
    (server) => {
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
          const header = await resolveDocket(docket_id.trim())
          if (!header) {
            return text({ found: false, message: `No docket "${docket_id}" in the NodalPulse Record.` })
          }

          // Gate: only surface what this user is entitled to see.
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

      // WS-C adds the other read tools here (list_watched_entities, list_deadlines,
      // get_mentions, discover_by_theme); WS-D adds ask_the_record (metered).
    },
    {},
    { basePath: "/api", maxDuration: 60, verboseLogs: false },
  )
}

const handler = withMcpAuth(auth, (req, session) => buildHandler(session.userId)(req))

export { handler as GET, handler as POST }
