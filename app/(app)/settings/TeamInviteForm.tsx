"use client"

import { useState } from "react"
import { inviteTeamMember, removeTeamMember, type TeamMember } from "./actions"

export function TeamInviteForm({
  members,
  seatLimit,
  usedSeats,
}: {
  members: TeamMember[]
  seatLimit: number
  usedSeats: number
}) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [localMembers, setLocalMembers] = useState<TeamMember[]>(members)
  const [localUsed, setLocalUsed] = useState(usedSeats)

  const atLimit = localUsed >= seatLimit - 1 // -1 for owner seat

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email || atLimit) return
    setStatus("loading")
    setMessage("")
    const result = await inviteTeamMember(email.trim())
    if (result.ok) {
      setStatus("done")
      setMessage(`Invite sent to ${email.trim()}`)
      setLocalMembers(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          inviteeEmail: email.trim().toLowerCase(),
          role: "member",
          status: "pending",
          invitedAt: new Date(),
          acceptedAt: null,
        },
      ])
      setLocalUsed(prev => prev + 1)
      setEmail("")
    } else {
      setStatus("error")
      setMessage(result.error ?? "Something went wrong.")
    }
  }

  async function handleRemove(membershipId: string, memberEmail: string) {
    const result = await removeTeamMember(membershipId)
    if (result.ok) {
      setLocalMembers(prev => prev.filter(m => m.id !== membershipId))
      setLocalUsed(prev => Math.max(0, prev - 1))
      setMessage(`Removed ${memberEmail}`)
      setStatus("done")
    } else {
      setMessage(result.error ?? "Failed to remove member.")
      setStatus("error")
    }
  }

  return (
    <div className="space-y-5">
      {/* Seat counter */}
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-[var(--np-text-body)]">Seat usage</span>
        <span className="text-[var(--np-text-strong)] font-mono">
          {localUsed + 1} / {seatLimit}
        </span>
      </div>

      {/* Members table */}
      {localMembers.length > 0 && (
        <div className="border border-[var(--np-border)] rounded-[var(--np-radius-md)] overflow-hidden">
          {localMembers.map((m, i) => (
            <div
              key={m.id}
              className={`
                flex items-center justify-between px-4 py-3 text-[13px]
                ${i < localMembers.length - 1 ? "border-b border-[var(--np-border)]" : ""}
              `}
            >
              <div>
                <span className="text-[var(--np-text-body)]">{m.inviteeEmail}</span>
                <span
                  className={`ml-2 text-[11px] ${
                    m.status === "accepted"
                      ? "text-[var(--np-success)]"
                      : "text-[var(--np-text-muted)]"
                  }`}
                >
                  {m.status === "accepted" ? "Accepted" : "Pending"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(m.id, m.inviteeEmail)}
                className="text-[var(--np-text-muted)] text-[12px] hover:text-[var(--np-danger)] transition-colors cursor-pointer"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      {atLimit ? (
        <p className="text-[var(--np-text-muted)] text-[13px]">
          Seat limit reached. Remove a member or{" "}
          <a href="/pricing" className="text-[var(--np-accent-text)] hover:underline">
            upgrade your plan
          </a>{" "}
          to invite more.
        </p>
      ) : (
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            disabled={status === "loading"}
            className="
              flex-1 h-9 px-3
              rounded-[var(--np-radius-md)]
              border border-[var(--np-border)]
              bg-[var(--np-surface-deep)]
              text-[var(--np-text-primary)] text-[13px]
              placeholder:text-[var(--np-text-muted)]
              outline-none focus:border-[var(--np-accent)]
              disabled:opacity-50
            "
          />
          <button
            type="submit"
            disabled={!email || status === "loading"}
            className="
              h-9 px-4 rounded-[var(--np-radius-md)]
              bg-[var(--np-accent)] text-[var(--np-accent-fg)]
              text-[13px] font-medium
              hover:bg-[var(--np-accent-hover)] transition-colors
              disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed
            "
          >
            {status === "loading" ? "Sending…" : "Invite"}
          </button>
        </form>
      )}

      {message && (
        <p
          className={`text-[12px] ${
            status === "error" ? "text-[var(--np-danger)]" : "text-[var(--np-success)]"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
