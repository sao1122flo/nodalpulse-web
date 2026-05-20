import { env } from "@/lib/env"
import type { Result, ServicesError } from "@/lib/types"

async function get<T>(
  path: string,
  params?: Record<string, string | number>,
  revalidate: number = 0,
): Promise<Result<T, ServicesError>> {
  const url = new URL(`${env.SERVICES_API_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
  }
  let resp: Response
  try {
    resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${env.SERVICES_API_KEY}` },
      next: { revalidate },
    } as RequestInit)
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

async function post<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number = 30_000,
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
      signal: AbortSignal.timeout(timeoutMs),
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

export interface RefreshDocketResult {
  docket_number: string
  queued: number
  already_extracted: number
}

export function refreshDocket(
  params: { docket_number: string; user_id: string; max_filings?: number },
  timeoutMs: number = 30_000,
): Promise<Result<RefreshDocketResult, ServicesError>> {
  return post("/extraction/refresh-docket", params, timeoutMs)
}

export interface LlmCostsResult {
  range: { from: string; to: string }
  totals: { cost_usd: number; calls: number }
  by_day: Array<{
    day: string
    stage: string
    model: string
    pricing_version: string
    calls: number
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
    cost_usd: number
  }>
}

export function getLlmCosts(days: number = 7): Promise<Result<LlmCostsResult, ServicesError>> {
  return get("/admin/llm-costs", { days }, 60)
}

export interface SavedSearchFiling {
  id: string
  title: string
  source_slug: string
  filed_at: string
  url: string | null
}

export interface SavedSearchFireResult {
  saved_search_id: string
  filing_count: number
  filings: SavedSearchFiling[]
}

export function fireSavedSearch(params: {
  user_id: string
  saved_search_id: string
}): Promise<Result<SavedSearchFireResult, ServicesError>> {
  return post("/saved-search/fire", params, 30_000)
}

// ── Q&A ───────────────────────────────────────────────────────────────────────

export interface QnaCitation {
  filing_id: string
  title: string
  source_url: string | null
  docket_number: string | null
  relevance_note: string
}

export interface QnaResult {
  answer: string
  citations: QnaCitation[]
  conversation_id: string
  tokens_used: {
    input: number
    output: number
    cache_read: number
    cache_creation: number
  }
  cost_estimate: number
  used_today: number
  limit_per_day: number
}

export interface QnaRateLimitError {
  error: "rate_limit"
  limit: number
  used: number
  resets_at: string
}

export interface QnaNoPredicatesError {
  error: "no_predicates"
  message: string
  actions: Array<{ label: string; href: string }>
}

export interface QnaUnavailableError {
  error: "qa_not_available"
  message: string
  upgrade_url: string
}

export interface QnaNoFilingsError {
  error: "no_filings"
  message: string
}

export type QnaServiceError =
  | QnaRateLimitError
  | QnaNoPredicatesError
  | QnaUnavailableError
  | QnaNoFilingsError

export function askQuestion(params: {
  user_id: string
  question: string
  conversation_id?: string
  limit_per_day: number
}): Promise<Result<QnaResult, ServicesError>> {
  return post("/qna", params, 60_000)
}

export interface QnaUsageResult {
  user_id: string
  used_today: number
}

export function getQnaUsage(
  userId: string,
): Promise<Result<QnaUsageResult, ServicesError>> {
  return get("/qna/usage", { user_id: userId })
}
