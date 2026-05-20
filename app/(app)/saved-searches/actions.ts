"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { savedSearches } from "@/db/schema"
import { and, count, eq, sql } from "drizzle-orm"
import { getEntitlements } from "@/lib/entitlements"
import { fireSavedSearch as fireSearchOnServices } from "@/lib/services-client"
import type { Result } from "@/lib/types"
import type { SavedSearchQuery } from "@/db/schema"
import type { SavedSearchFiling } from "@/lib/services-client"

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthenticated")
  return session
}

export type SavedSearchRow = {
  id: string
  name: string
  query: SavedSearchQuery
  notify: boolean
  lastFiredAt: Date | null
  createdAt: Date
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listSavedSearches(): Promise<SavedSearchRow[]> {
  const session = await getSession()
  return db
    .select({
      id: savedSearches.id,
      name: savedSearches.name,
      query: savedSearches.query,
      notify: savedSearches.notify,
      lastFiredAt: savedSearches.lastFiredAt,
      createdAt: savedSearches.createdAt,
    })
    .from(savedSearches)
    .where(eq(savedSearches.userId, session.user.id))
    .orderBy(savedSearches.createdAt)
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createSavedSearch(
  name: string,
  query: SavedSearchQuery,
): Promise<Result<{ id: string }>> {
  const session = await getSession()
  const userId = session.user.id

  const ents = await getEntitlements(userId)
  const limit = ents.savedSearches.limit

  if (limit === 0) {
    return { ok: false, error: "Upgrade to a paid plan to create saved searches." }
  }

  if (limit !== null) {
    const [{ ct }] = await db
      .select({ ct: count() })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
    if (Number(ct) >= limit) {
      return {
        ok: false,
        error: `You've reached your ${limit} saved search limit. Upgrade at /pricing for more.`,
      }
    }
  }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "Search name is required." }

  const [row] = await db
    .insert(savedSearches)
    .values({ userId, name: trimmed, query })
    .onConflictDoNothing()
    .returning({ id: savedSearches.id })

  if (!row) {
    return { ok: false, error: `A saved search named "${trimmed}" already exists.` }
  }

  return { ok: true, value: { id: row.id } }
}

// ---------------------------------------------------------------------------
// Update (name and/or notify)
// ---------------------------------------------------------------------------

export async function updateSavedSearch(
  id: string,
  patch: { name?: string; notify?: boolean },
): Promise<Result<void>> {
  const session = await getSession()

  const updates: Partial<{ name: string; notify: boolean }> = {}
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim()
    if (!trimmed) return { ok: false, error: "Search name is required." }
    updates.name = trimmed
  }
  if (patch.notify !== undefined) {
    updates.notify = patch.notify
  }

  if (Object.keys(updates).length === 0) return { ok: true, value: undefined }

  await db
    .update(savedSearches)
    .set(updates)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.user.id)))

  return { ok: true, value: undefined }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteSavedSearch(id: string): Promise<Result<void>> {
  const session = await getSession()
  await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.user.id)))
  return { ok: true, value: undefined }
}

// ---------------------------------------------------------------------------
// Fire — runs the saved search predicates against recent filings via services,
// then records the last_fired_at timestamp on success.
// ---------------------------------------------------------------------------

export async function fireSavedSearch(
  id: string,
): Promise<Result<{ filings: SavedSearchFiling[]; count: number }>> {
  const session = await getSession()
  const userId = session.user.id

  // Verify ownership before calling services
  const [row] = await db
    .select({ id: savedSearches.id })
    .from(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
    .limit(1)

  if (!row) return { ok: false, error: "Saved search not found." }

  const result = await fireSearchOnServices({ user_id: userId, saved_search_id: id })
  if (!result.ok) {
    const msg =
      result.error.kind === "not_found"
        ? "Saved search not found on the server."
        : result.error.kind === "network"
          ? "Could not reach the search service. Please try again."
          : "Search failed. Please try again."
    return { ok: false, error: msg }
  }

  // Record fire time (fire-and-forget — don't fail the action if this errors)
  db.update(savedSearches)
    .set({ lastFiredAt: sql`NOW()` })
    .where(eq(savedSearches.id, id))
    .catch((e) => console.error("[fireSavedSearch] failed to update lastFiredAt:", e))

  return {
    ok: true,
    value: { filings: result.value.filings, count: result.value.filing_count },
  }
}
