"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { userProfiles } from "@/db/schema"

export async function saveProfile(data: {
  role: string
  markets: string[]
  docketIds: string[]
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthenticated")

  await db
    .insert(userProfiles)
    .values({
      userId: session.user.id,
      marketRoles: [data.role],
      trackedTags: data.markets,
      trackedDocketIds: [],
      emailFormat: "html",
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        marketRoles: [data.role],
        trackedTags: data.markets,
      },
    })

  // Optionally enqueue a compose-brief job. Gracefully skip if not configured.
  const internalApiUrl = process.env.INTERNAL_API_URL
  if (internalApiUrl) {
    try {
      await fetch(`${internalApiUrl}/compose-brief/now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      })
    } catch {
      // Non-fatal — brief will be generated on next scheduled run
      console.warn("[saveProfile] Failed to enqueue compose-brief job")
    }
  }
}
