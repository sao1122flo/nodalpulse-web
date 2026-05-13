import { env } from "@/lib/env"
import type { Result, ServicesError } from "@/lib/types"

async function post<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<Result<T, ServicesError>> {
  let resp: Response
  try {
    resp = await fetch(`${env.SERVICES_API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SERVICES_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    return { ok: false, error: { kind: "network", message: String(e) } }
  }
  if (resp.status === 401) return { ok: false, error: { kind: "unauthorized" } }
  if (resp.status === 404) return { ok: false, error: { kind: "not_found" } }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    return { ok: false, error: { kind: "unexpected", status: resp.status, body: text } }
  }
  return { ok: true, value: (await resp.json()) as T }
}

export interface EnqueueResult {
  job_id: string
  status: "queued" | "already_queued"
}

export function recomposeBrief(params: {
  user_id: string
  brief_date: string
  idempotency_key: string
}): Promise<Result<EnqueueResult, ServicesError>> {
  return post("/brief/recompose", params)
}

export function refreshExtraction(params: {
  filing_id: string
  idempotency_key: string
}): Promise<Result<EnqueueResult, ServicesError>> {
  return post("/extraction/refresh", params)
}
