"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { db } from "@/db/client"
import { subscriptions, teamMemberships, users, apiKeys } from "@/db/schema"
import { and, eq, isNull, ne, count } from "drizzle-orm"
import { randomBytes, createHash } from "node:crypto"
import { getEntitlements } from "@/lib/entitlements"
import { sendTeamInviteEmail } from "@/lib/email"
import { requestBriefHistoryExport } from "@/lib/services-client"

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nodalpulse.com"

export async function createPortalSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthenticated")

  const [sub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1)

  if (!sub?.stripeCustomerId) throw new Error("No Stripe customer found")

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl()}/settings`,
  })

  redirect(portalSession.url)
}

// ---------------------------------------------------------------------------
// Team invitations
// ---------------------------------------------------------------------------

export type TeamMember = {
  id: string
  inviteeEmail: string
  role: string
  status: string
  invitedAt: Date
  acceptedAt: Date | null
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return []

  return db
    .select({
      id:           teamMemberships.id,
      inviteeEmail: teamMemberships.inviteeEmail,
      role:         teamMemberships.role,
      status:       teamMemberships.status,
      invitedAt:    teamMemberships.invitedAt,
      acceptedAt:   teamMemberships.acceptedAt,
    })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.ownerId, session.user.id),
        ne(teamMemberships.status, "revoked"),
      )
    )
    .orderBy(teamMemberships.invitedAt)
}

export async function inviteTeamMember(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Not authenticated" }

  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Invalid email address." }
  }
  if (trimmed === session.user.email.toLowerCase()) {
    return { ok: false, error: "You can't invite yourself." }
  }

  const ents = await getEntitlements(session.user.id)
  if (ents.teamSeats.limit <= 1) {
    return { ok: false, error: "Team invitations require Team plan or higher." }
  }

  // Count active (non-revoked) memberships; +1 for the owner seat.
  const [{ total }] = await db
    .select({ total: count() })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.ownerId, session.user.id),
        ne(teamMemberships.status, "revoked"),
      )
    )
  if (Number(total) + 1 >= ents.teamSeats.limit) {
    return { ok: false, error: `Seat limit reached (${ents.teamSeats.limit} total seats).` }
  }

  // Check if already invited.
  const [existing] = await db
    .select({ id: teamMemberships.id, status: teamMemberships.status })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.ownerId, session.user.id),
        eq(teamMemberships.inviteeEmail, trimmed),
      )
    )
    .limit(1)

  let membershipId: string
  if (existing) {
    if (existing.status !== "revoked") {
      return { ok: false, error: "This person has already been invited." }
    }
    await db
      .update(teamMemberships)
      .set({ status: "pending", invitedAt: new Date(), acceptedAt: null })
      .where(eq(teamMemberships.id, existing.id))
    membershipId = existing.id
  } else {
    const [row] = await db
      .insert(teamMemberships)
      .values({ ownerId: session.user.id, inviteeEmail: trimmed })
      .returning({ id: teamMemberships.id })
    membershipId = row.id
  }

  // Link existing user account if present.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, trimmed))
    .limit(1)
  if (existingUser) {
    await db
      .update(teamMemberships)
      .set({ inviteeUserId: existingUser.id })
      .where(eq(teamMemberships.id, membershipId))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nodalpulse.com"
  const acceptUrl = `${appUrl}/invite/accept?id=${membershipId}`

  try {
    await sendTeamInviteEmail({
      to: trimmed,
      ownerName: session.user.name ?? session.user.email,
      ownerEmail: session.user.email,
      acceptUrl,
    })
  } catch {
    // Don't surface email errors to the user — invite row exists; they can resend.
  }

  return { ok: true }
}

export async function removeTeamMember(
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Not authenticated" }

  const [membership] = await db
    .select({ id: teamMemberships.id, ownerId: teamMemberships.ownerId })
    .from(teamMemberships)
    .where(eq(teamMemberships.id, membershipId))
    .limit(1)

  if (!membership || membership.ownerId !== session.user.id) {
    return { ok: false, error: "Not found." }
  }

  await db
    .update(teamMemberships)
    .set({ status: "revoked" })
    .where(eq(teamMemberships.id, membershipId))

  return { ok: true }
}

export async function acceptTeamInvite(
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Not authenticated" }

  const [membership] = await db
    .select({
      id:           teamMemberships.id,
      inviteeEmail: teamMemberships.inviteeEmail,
      status:       teamMemberships.status,
    })
    .from(teamMemberships)
    .where(eq(teamMemberships.id, membershipId))
    .limit(1)

  if (!membership) return { ok: false, error: "Invitation not found." }
  if (membership.status === "accepted") return { ok: true }
  if (membership.status === "revoked") return { ok: false, error: "This invitation has been revoked." }
  if (membership.inviteeEmail !== session.user.email.toLowerCase()) {
    return { ok: false, error: "This invitation was sent to a different email address." }
  }

  await db
    .update(teamMemberships)
    .set({ status: "accepted", inviteeUserId: session.user.id, acceptedAt: new Date() })
    .where(eq(teamMemberships.id, membershipId))

  return { ok: true }
}

// ---------------------------------------------------------------------------
// API keys (Org-tier)
// Key format: np_<8-char-prefix>_<32-char-random-hex>
// The prefix is stored plaintext; only the SHA-256 hash of the full key is
// stored. The full key is returned ONCE at creation and never retrievable again.
// ---------------------------------------------------------------------------

export type ApiKeyRecord = {
  id:         string
  label:      string
  keyPrefix:  string
  createdAt:  Date
  lastUsedAt: Date | null
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return []

  return db
    .select({
      id:         apiKeys.id,
      label:      apiKeys.label,
      keyPrefix:  apiKeys.keyPrefix,
      createdAt:  apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.userId, session.user.id),
        isNull(apiKeys.revokedAt),
      )
    )
    .orderBy(apiKeys.createdAt)
}

export async function createApiKey(
  label: string,
): Promise<{ ok: boolean; key?: string; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Not authenticated" }

  const trimmedLabel = label.trim()
  if (!trimmedLabel) return { ok: false, error: "Label is required." }
  if (trimmedLabel.length > 64) return { ok: false, error: "Label too long (max 64 characters)." }

  const ents = await getEntitlements(session.user.id)
  if (!ents.apiAccess) {
    return { ok: false, error: "API access requires the Org plan." }
  }

  // Max 10 active keys per user.
  const [{ total }] = await db
    .select({ total: count() })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, session.user.id), isNull(apiKeys.revokedAt)))
  if (Number(total) >= 10) {
    return { ok: false, error: "Maximum of 10 active API keys reached." }
  }

  const prefix = randomBytes(4).toString("hex")        // 8 hex chars
  const secret = randomBytes(16).toString("hex")       // 32 hex chars
  const fullKey = `np_${prefix}_${secret}`
  const keyHash = createHash("sha256").update(fullKey).digest("hex")

  await db.insert(apiKeys).values({
    userId:    session.user.id,
    label:     trimmedLabel,
    keyPrefix: prefix,
    keyHash,
  })

  // fullKey is returned ONCE and not stored in plaintext.
  return { ok: true, key: fullKey }
}

export async function revokeApiKey(
  keyId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Not authenticated" }

  const [key] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1)

  if (!key || key.userId !== session.user.id) {
    return { ok: false, error: "Key not found." }
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId))

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Brief history export (Org-tier)
// ---------------------------------------------------------------------------

export async function requestBriefExport(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Not authenticated" }

  const ents = await getEntitlements(session.user.id)
  if (!ents.auditExport) {
    return { ok: false, error: "Brief history export requires the Org plan." }
  }

  const result = await requestBriefHistoryExport({
    user_id: session.user.id,
    user_email: session.user.email,
  })

  if (!result.ok) {
    return { ok: false, error: "Failed to queue export. Please try again." }
  }

  return { ok: true }
}
