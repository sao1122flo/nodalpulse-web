import "server-only"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { env } from "@/lib/env"

export type AdminResult =
  | { ok: true; email: string }
  | { ok: false; error: "Unauthenticated" | "Forbidden" }

export async function requireAdmin(): Promise<AdminResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: "Unauthenticated" }
  if (!env.ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return { ok: false, error: "Forbidden" }
  }
  return { ok: true, email: session.user.email }
}
