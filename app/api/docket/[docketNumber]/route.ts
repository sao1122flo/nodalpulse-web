import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets, filings, extractions } from "@/db/schema"
import { and, eq, desc, isNotNull, count } from "drizzle-orm"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docketNumber: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { docketNumber } = await params
  const dn = decodeURIComponent(docketNumber)

  const [docketRow] = await db
    .select({
      id:           dockets.id,
      jurisdiction: dockets.jurisdiction,
      title:        dockets.title,
      externalId:   dockets.externalId,
    })
    .from(dockets)
    .leftJoin(filings, eq(filings.docketId, dockets.id))
    .where(and(eq(dockets.externalId, dn), isNotNull(dockets.jurisdiction)))
    .groupBy(dockets.id, dockets.jurisdiction)
    .orderBy(desc(count(filings.id)))
    .limit(1)

  if (!docketRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const filingRows = await db
    .select({
      id:        filings.id,
      title:     filings.title,
      docType:   filings.docType,
      filedAt:   filings.filedAt,
      sourceUrl: filings.sourceUrl,
      filer:     filings.filer,
      payload:   extractions.payload,
    })
    .from(filings)
    .leftJoin(extractions, eq(extractions.filingId, filings.id))
    .where(eq(filings.docketId, docketRow.id))
    .orderBy(desc(filings.filedAt))
    .limit(50)

  const normalizeParty = (name: string) => name.replace(/\s*\(.*$/, "").trim()
  const allParties = filingRows.flatMap(r => r.payload?.parties ?? [])
  const parties = [...new Set(allParties.map(normalizeParty))].filter(Boolean).sort()

  const rawTimeline: Array<{ date: string; description: string; type: string }> = []
  for (const row of filingRows) {
    for (const d of row.payload?.deadlines ?? []) {
      if (d.date) rawTimeline.push({ date: d.date, description: d.description, type: "deadline" })
    }
    if (row.payload?.effective_date) {
      rawTimeline.push({
        date:        row.payload.effective_date,
        description: `Effective — ${row.title}`,
        type:        "effective",
      })
    }
  }
  const seen = new Set<string>()
  const timeline = rawTimeline
    .filter(e => {
      const k = `${e.date}:${e.description}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const [trackRecord] = await db
    .select({ id: userDockets.id })
    .from(userDockets)
    .where(and(
      eq(userDockets.userId, session.user.id),
      eq(userDockets.docketId, docketRow.id),
    ))
    .limit(1)

  return NextResponse.json({
    docket: {
      externalId:   docketRow.externalId,
      jurisdiction: docketRow.jurisdiction,
      title:        docketRow.title,
      isTracked:    !!trackRecord,
    },
    filings: filingRows.map(f => ({
      id:        f.id,
      title:     f.title,
      docType:   f.docType,
      filedAt:   f.filedAt.toISOString(),
      sourceUrl: f.sourceUrl,
      filer:     f.filer,
      summary:   f.payload?.summary ?? null,
    })),
    parties,
    timeline,
  })
}
