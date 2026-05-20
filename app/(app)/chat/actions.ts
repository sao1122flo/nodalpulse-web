"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getEntitlements } from "@/lib/entitlements"
import { askQuestion } from "@/lib/services-client"
import type { QnaResult } from "@/lib/services-client"

export type AskResult =
  | { ok: true; value: QnaResult }
  | { ok: false; error: string; errorCode?: string; errorPayload?: unknown }

export async function sendQuestion(
  question: string,
  conversationId: string | null,
): Promise<AskResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { ok: false, error: "Not authenticated", errorCode: "unauthenticated" }
  }

  const trimmed = question.trim()
  if (!trimmed) {
    return { ok: false, error: "Question cannot be empty." }
  }
  if (trimmed.length > 1000) {
    return { ok: false, error: "Question is too long (max 1000 characters)." }
  }

  const ents = await getEntitlements(session.user.id)
  const limitPerDay = ents.qa.limitPerDay ?? 0

  const result = await askQuestion({
    user_id: session.user.id,
    question: trimmed,
    conversation_id: conversationId ?? undefined,
    limit_per_day: limitPerDay,
  })

  if (!result.ok) {
    const e = result.error
    let error: string
    if (e.kind === "network") {
      error = "Could not reach the Q&A service. Please try again."
    } else if (e.kind === "unexpected" && e.status === 429) {
      error = "__rate_limit__"
    } else if (e.kind === "unexpected" && e.status === 422) {
      error = "__no_predicates__"
    } else if (e.kind === "unexpected" && e.status === 403) {
      error = "__unavailable__"
    } else if (process.env.NODE_ENV === "development") {
      error = e.kind === "unexpected"
        ? `Services ${e.status}: ${e.body?.slice(0, 300)}`
        : `Services error: ${e.kind}`
    } else {
      error = "Q&A failed. Please try again."
    }

    return {
      ok: false,
      error,
      errorCode: e.kind === "unexpected" ? String(e.status) : e.kind,
      errorPayload: e.kind === "unexpected" ? (() => {
        try { return JSON.parse(e.body ?? "{}") } catch { return { raw: e.body } }
      })() : undefined,
    }
  }

  return { ok: true, value: result.value }
}
