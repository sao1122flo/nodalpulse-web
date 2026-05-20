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
    return {
      ok: false,
      error: result.error.kind === "network"
        ? "Could not reach the Q&A service. Please try again."
        : result.error.kind === "unexpected" && result.error.status === 429
          ? "__rate_limit__"
          : result.error.kind === "unexpected" && result.error.status === 422
            ? "__no_predicates__"
            : result.error.kind === "unexpected" && result.error.status === 403
              ? "__unavailable__"
              : "Q&A failed. Please try again.",
      errorCode: result.error.kind === "unexpected" ? String(result.error.status) : result.error.kind,
      errorPayload: result.error.kind === "unexpected" ? (() => {
        try { return JSON.parse(result.error.body ?? "{}") } catch { return {} }
      })() : undefined,
    }
  }

  return { ok: true, value: result.value }
}
