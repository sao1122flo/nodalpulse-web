"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { and, eq } from "drizzle-orm"
import { createHash } from "node:crypto"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { watchedThemes, discoveryDismissals, themeRequests, adminActions } from "@/db/schema"
import type { Result } from "@/lib/types"

// Subscribe the current user to a curated theme (by stable key).
export async function addWatchedTheme(themeKey: string): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const key = themeKey.trim()
  if (!key) return { ok: false, error: "Missing theme" }

  await db
    .insert(watchedThemes)
    .values({ userId: session.user.id, themeKey: key })
    .onConflictDoNothing()

  revalidatePath("/discovery")
  return { ok: true, value: undefined }
}

export async function removeWatchedTheme(themeKey: string): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  await db
    .delete(watchedThemes)
    .where(and(eq(watchedThemes.userId, session.user.id), eq(watchedThemes.themeKey, themeKey.trim())))

  revalidatePath("/discovery")
  return { ok: true, value: undefined }
}

// "Not relevant" — hides the item for this user AND feeds matcher tuning later.
export async function dismissDiscoveryItem(
  accession: string,
  reason?: string,
): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const acc = accession.trim()
  if (!acc) return { ok: false, error: "Missing item" }

  await db
    .insert(discoveryDismissals)
    .values({ userId: session.user.id, accession: acc, reason: reason?.trim() || null })
    .onConflictDoNothing()

  revalidatePath("/discovery")
  return { ok: true, value: undefined }
}

// "Request a theme" — does NOT classify per-user; captures demand for manual
// curation. Persists the request and logs an admin audit row for triage.
export async function requestTheme(label: string, note?: string): Promise<Result<void>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }

  const lbl = label.trim()
  if (!lbl) return { ok: false, error: "Theme name is required" }
  if (lbl.length > 120) return { ok: false, error: "Theme name is too long" }

  await db.insert(themeRequests).values({
    userId: session.user.id,
    label:  lbl,
    note:   note?.trim() || null,
  })

  try {
    const actorEmailHash = createHash("sha256")
      .update(session.user.email.toLowerCase())
      .digest("hex")
    await db.insert(adminActions).values({
      actorEmailHash,
      action:     "theme_request",
      targetType: "theme",
      targetId:   lbl,
      metadata:   { note: note?.trim() ?? null, userId: session.user.id },
    })
  } catch (e) {
    console.error("[requestTheme] failed to log admin action", { label: lbl, error: String(e) })
  }

  revalidatePath("/discovery")
  return { ok: true, value: undefined }
}
