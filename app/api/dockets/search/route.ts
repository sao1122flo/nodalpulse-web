import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userDockets, dockets } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tracked = await db
    .select({
      externalId:   dockets.externalId,
      title:        dockets.title,
      jurisdiction: dockets.jurisdiction,
    })
    .from(userDockets)
    .innerJoin(dockets, eq(userDockets.docketId, dockets.id))
    .where(eq(userDockets.userId, session.user.id))
    .orderBy(desc(userDockets.createdAt))
    .limit(100)

  return NextResponse.json({ dockets: tracked })
}
