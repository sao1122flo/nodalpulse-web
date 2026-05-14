"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets, filings, extractions } from "@/db/schema"
import { and, eq, desc, sql } from "drizzle-orm"
import type { Result } from "@/lib/types"

// PUCT source UUID — stable, seeded by services on startup.
const PUCT_SOURCE_ID = "0725032a-239f-475d-bdd5-251adad3ae05"

export async function trackDocket({
  docketNumber,
}: {
  docketNumber: string
}): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const dn = docketNumber.trim()
  if (!dn) return { ok: false, error: "Docket number is required" }
  if (dn.includes(" ")) return { ok: false, error: "Docket number must not contain spaces" }

  // Find or create the docket entity (UNIQUE on source_id + external_id)
  let [docketRow] = await db
    .select({ id: dockets.id })
    .from(dockets)
    .where(and(eq(dockets.sourceId, PUCT_SOURCE_ID), eq(dockets.externalId, dn)))
    .limit(1)

  if (!docketRow) {
    const [labelRow] = await db
      .select({ title: filings.title })
      .from(extractions)
      .innerJoin(filings, eq(extractions.filingId, filings.id))
      .where(sql`${extractions.payload}->>'docket_number' = ${dn}`)
      .orderBy(desc(filings.filedAt))
      .limit(1)

    await db
      .insert(dockets)
      .values({
        sourceId:   PUCT_SOURCE_ID,
        externalId: dn,
        title:      labelRow?.title ?? null,
        status:     "open",
      })
      .onConflictDoNothing()

    const [created] = await db
      .select({ id: dockets.id })
      .from(dockets)
      .where(and(eq(dockets.sourceId, PUCT_SOURCE_ID), eq(dockets.externalId, dn)))
      .limit(1)

    docketRow = created
  }

  if (!docketRow) return { ok: false, error: "Failed to create docket" }

  await db
    .insert(userDockets)
    .values({ userId: session.user.id, docketId: docketRow.id })
    .onConflictDoNothing()

  revalidatePath("/dockets")
  revalidatePath(`/dockets/${dn}`)
  return { ok: true, value: undefined }
}

export async function untrackDocket({
  docketNumber,
}: {
  docketNumber: string
}): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const dn = docketNumber.trim()

  const [docketRow] = await db
    .select({ id: dockets.id })
    .from(dockets)
    .where(and(eq(dockets.sourceId, PUCT_SOURCE_ID), eq(dockets.externalId, dn)))
    .limit(1)

  if (docketRow) {
    await db
      .delete(userDockets)
      .where(
        and(
          eq(userDockets.userId, session.user.id),
          eq(userDockets.docketId, docketRow.id),
        ),
      )
  }

  revalidatePath("/dockets")
  revalidatePath(`/dockets/${dn}`)
  return { ok: true, value: undefined }
}
