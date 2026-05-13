const _windows = new Map<string, number[]>()
const LIMIT = 10
const WINDOW_MS = 60_000

export function checkRateLimit(email: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  const timestamps = (_windows.get(email) ?? []).filter(t => now - t < WINDOW_MS)
  if (timestamps.length >= LIMIT) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - timestamps[0]) }
  }
  timestamps.push(now)
  _windows.set(email, timestamps)
  return { ok: true }
}
