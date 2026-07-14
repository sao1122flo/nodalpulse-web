// In-memory per-user rate limiter for MCP READ tools (WS-C).
//
// This is a light fair-use guardrail against abuse of the unmetered read tools —
// it is NOT the AI action quota. AI actions (ask_the_record, summaries) are metered
// separately against llm_calls (the daily/monthly quota). Reads are free at every
// tier; this limiter only stops a runaway client from hammering the DB.
//
// Per-instance and in-memory by design: it resets on deploy and isn't shared across
// instances. That's acceptable — it's a burst guardrail, not billing. If reads ever
// need durable/global limiting, move the counter to the DB (as the AI limiter does).

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60 // read tool calls per user per minute

interface Bucket {
  count:   number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateResult {
  ok:            boolean
  retryAfterSec: number
}

export function checkReadRate(userId: string): RateResult {
  const now = Date.now()

  // Opportunistic prune so the map can't grow unbounded across many users.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
  }

  const b = buckets.get(userId)
  if (!b || now >= b.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, retryAfterSec: 0 }
  }
  if (b.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  b.count++
  return { ok: true, retryAfterSec: 0 }
}
