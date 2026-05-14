import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { AddDocketForm } from "./AddDocketForm"
import { UntrackButton } from "./UntrackButton"

export const metadata: Metadata = { title: "Dockets" }

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
      id:         dockets.id,
      externalId: dockets.externalId,
      title:      dockets.title,
      status:     dockets.status,
      trackedAt:  userDockets.createdAt,
    })
    .from(userDockets)
    .innerJoin(dockets, eq(userDockets.docketId, dockets.id))
    .where(eq(userDockets.userId, session.user.id))
    .orderBy(desc(userDockets.createdAt))

  return (
    <div className="px-8 py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Dockets
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          Track PUCT dockets for targeted coverage in your daily brief.
        </p>
      </div>

      <AddDocketForm />

      {tracked.length === 0 ? (
        <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-12 text-center">
          <h2 className="text-[var(--np-text-strong)] font-medium text-[14px] mb-2">
            No tracked dockets yet
          </h2>
          <p className="text-[var(--np-text-muted)] text-[13px] max-w-sm mx-auto leading-relaxed">
            Enter a PUCT control number above to track it. Your brief will always include
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
                  {["Docket", "Label", "Tracked since", ""].map(col => (
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
                {tracked.map(d => (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--np-border)] last:border-0"
                    style={{ height: "40px" }}
                  >
                    <td className="px-4 py-0 font-medium text-[var(--np-text-strong)]">
                      <Link
                        href={`/dockets/${d.externalId}`}
                        className="hover:text-[var(--np-accent-text)] transition-colors"
                      >
                        {d.externalId}
                      </Link>
                    </td>
                    <td className="px-4 py-0 text-[var(--np-text-body)] max-w-[260px] truncate">
                      {d.title ?? <span className="text-[var(--np-text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-0 text-[var(--np-text-body)]">
                      {formatDate(d.trackedAt)}
                    </td>
                    <td className="px-4 py-0 text-right">
                      <UntrackButton docketNumber={d.externalId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden flex flex-col gap-2">
            {tracked.map(d => (
              <div
                key={d.id}
                className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <Link
                    href={`/dockets/${d.externalId}`}
                    className="text-[var(--np-text-strong)] font-medium text-[14px] hover:text-[var(--np-accent-text)] transition-colors"
                  >
                    {d.externalId}
                  </Link>
                  <UntrackButton docketNumber={d.externalId} />
                </div>
                {d.title && (
                  <p className="text-[var(--np-text-muted)] text-[12px] truncate">{d.title}</p>
                )}
                <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                  Tracked since {formatDate(d.trackedAt)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
