// Stable identity for extracted items in the unified feedback store (B4).
// Pure + client-safe (no db / server-only) so both the client affordance and the
// server read can derive the same item_ref. Deadlines have no DB id (they live in
// the extraction JSONB payload), so we hash the identity fields the UI shows —
// the same shape the ICS UID uses. Not perfect across re-phrasings, but it's what
// the user is actually reporting on screen.

export type FeedbackItemType =
  | "deadline"
  | "party"
  | "theme"
  | "discovery"
  | "extraction"
  | "fact"

// FNV-1a → base36. Deterministic across runs and across server/client.
function fnv1a(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

// item_ref for a deadline: docket + date + type + description identity.
export function deadlineFeedbackRef(d: {
  docketExternalId: string
  date: string
  type: string
  description: string
}): string {
  return fnv1a(`${d.docketExternalId}|${d.date}|${d.type}|${d.description}`)
}
