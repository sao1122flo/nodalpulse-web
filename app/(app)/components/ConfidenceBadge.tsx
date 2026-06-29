// Shared confidence treatment for extracted dates (B4). One convention across
// every surface — Record, Deadlines, dashboard strip — so new surfaces inherit
// it. We deliberately show `confirmed` vs `est` (a real stated date vs an
// inferred one); there is NO fabricated numeric confidence score.
//
// `estOnly` renders nothing for confirmed items (compact contexts like the
// dashboard strip badge only the estimated ones).

export function ConfidenceBadge({
  estimated,
  estOnly = false,
}: {
  estimated: boolean
  estOnly?: boolean
}) {
  if (estimated) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(251,191,36,0.12)] text-[#B45309] border border-[rgba(251,191,36,0.35)]">
        est
      </span>
    )
  }
  if (estOnly) return null
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(34,197,94,0.10)] text-[var(--np-success)] border border-[rgba(34,197,94,0.30)]">
      confirmed
    </span>
  )
}
