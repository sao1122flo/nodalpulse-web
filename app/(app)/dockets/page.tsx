import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets, filings } from "@/db/schema"
import { eq, desc, inArray, sql } from "drizzle-orm"
import { AddDocketForm } from "./AddDocketForm"
import { UntrackButton } from "./UntrackButton"

export const metadata: Metadata = { title: "Dockets" }

const JURISDICTION_BADGE: Record<string, string> = {
  PUCT:         "PUCT",
  ERCOT:        "ERCOT",
  "CAISO-FERC": "CAISO",
  CAISO:        "CAISO",
  CPUC:         "CPUC",
  "PJM-FERC":   "PJM",
  PJM:          "PJM",
  FERC:         "FERC",
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export default async function DocketsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const tracked = await db
    .select({
      id:           dockets.id,
      externalId:   dockets.externalId,
      title:        dockets.title,
      status:       dockets.status,
      jurisdiction: dockets.jurisdiction,
      trackedAt:    userDockets.createdAt,
    })
    .from(userDockets)
    .innerJoin(dockets, eq(userDockets.docketId, dockets.id))
    .where(eq(userDockets.userId, session.user.id))
    .orderBy(desc(userDockets.createdAt))

  // Last filing date per docket — shown as "Last activity"
  const lastFiledRows = tracked.length > 0
    ? await db
        .select({
          docketId: filings.docketId,
          lastFiled: sql<string>`max(${filings.filedAt})`,
        })
        .from(filings)
        .where(inArray(filings.docketId, tracked.map(d => d.id)))
        .groupBy(filings.docketId)
    : []

  const lastFiledMap = new Map(
    lastFiledRows.map(r => [r.docketId!, r.lastFiled ? new Date(r.lastFiled) : null])
  )

  return (
    <div className="px-8 py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Dockets
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          Track regulatory dockets for targeted coverage in your daily brief.
        </p>
      </div>

      <AddDocketForm />

      {tracked.length === 0 ? (
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-12 text-center">
          <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-2">
            No tracked dockets yet
          </h2>
          <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed">
            Enter a docket number above to track it. Your brief will always include
            the latest filings for tracked dockets.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--np-border)]">
                  {["Proceeding", "Last activity", ""].map(col => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-[var(--np-text-muted)] text-[11px] font-medium uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tracked.map(d => {
                  const lastFiled = lastFiledMap.get(d.id)
                  const jurisdictionLabel = d.jurisdiction
                    ? (JURISDICTION_BADGE[d.jurisdiction] ?? d.jurisdiction)
                    : null
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-[var(--np-border)] last:border-0 hover:bg-[var(--np-surface-deep)] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          {jurisdictionLabel && (
                            <span className="flex-shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)] font-medium">
                              {jurisdictionLabel}
                            </span>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/dockets/${encodeURIComponent(d.externalId)}`}
                              className="font-medium text-[var(--np-text-primary)] hover:text-[var(--np-accent-text)] transition-colors block"
                            >
                              {d.externalId}
                            </Link>
                            {d.title && (
                              <p className="text-[var(--np-text-muted)] text-[12px] truncate max-w-[340px]">
                                {d.title}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-[var(--np-text-muted)] text-[12px] w-36">
                        {lastFiled
                          ? formatDate(lastFiled)
                          : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 align-top text-right w-36">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/dockets/${encodeURIComponent(d.externalId)}`}
                            className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
                          >
                            View →
                          </Link>
                          <UntrackButton docketNumber={d.externalId} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden flex flex-col gap-2">
            {tracked.map(d => {
              const lastFiled = lastFiledMap.get(d.id)
              const jurisdictionLabel = d.jurisdiction
                ? (JURISDICTION_BADGE[d.jurisdiction] ?? d.jurisdiction)
                : null
              return (
                <div
                  key={d.id}
                  className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {jurisdictionLabel && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)] font-medium">
                          {jurisdictionLabel}
                        </span>
                      )}
                      <Link
                        href={`/dockets/${encodeURIComponent(d.externalId)}`}
                        className="text-[var(--np-text-primary)] font-medium text-[13px] hover:text-[var(--np-accent-text)] transition-colors truncate"
                      >
                        {d.externalId}
                      </Link>
                    </div>
                    <UntrackButton docketNumber={d.externalId} />
                  </div>
                  {d.title && (
                    <p className="text-[var(--np-text-muted)] text-[12px] truncate mb-1">{d.title}</p>
                  )}
                  <div className="flex items-center gap-3">
                    {lastFiled && (
                      <p className="text-[var(--np-text-muted)] text-[12px]">
                        Last activity {formatDate(lastFiled)}
                      </p>
                    )}
                    <Link
                      href={`/dockets/${encodeURIComponent(d.externalId)}`}
                      className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors ml-auto"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
