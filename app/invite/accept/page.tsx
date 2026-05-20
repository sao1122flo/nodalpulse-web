import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { acceptTeamInvite } from "@/app/(app)/settings/actions"

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams

  if (!id) {
    redirect("/login")
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    // Redirect to login, then come back here.
    redirect(`/login?callbackURL=${encodeURIComponent(`/invite/accept?id=${id}`)}`)
  }

  const result = await acceptTeamInvite(id)

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--np-surface)]">
      <div
        className="
          w-full max-w-[400px] mx-auto
          rounded-[var(--np-radius-lg)] border border-[var(--np-border)]
          bg-[var(--np-surface-elevated)] p-8
        "
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center gap-2 mb-6">
          <span className="text-[var(--np-accent)] text-[10px]" aria-hidden="true">&#9632;</span>
          <span className="font-bold text-[var(--np-text-primary)] text-base tracking-tight">NodalPulse</span>
        </div>

        {result.ok ? (
          <>
            <h1 className="text-[var(--np-text-primary)] font-semibold text-[18px] mb-2 tracking-tight">
              You&rsquo;re in the team
            </h1>
            <p className="text-[var(--np-text-muted)] text-[13px] mb-6">
              Your invitation has been accepted. You can now access your team&rsquo;s shared workspace.
            </p>
            <a
              href="/dashboard"
              className="
                inline-flex items-center justify-center w-full h-9
                rounded-[var(--np-radius-md)]
                bg-[var(--np-accent)] text-[var(--np-accent-fg)]
                text-[13px] font-medium
                hover:bg-[var(--np-accent-hover)] transition-colors
              "
            >
              Go to dashboard
            </a>
          </>
        ) : (
          <>
            <h1 className="text-[var(--np-text-primary)] font-semibold text-[18px] mb-2 tracking-tight">
              Invitation error
            </h1>
            <p className="text-[var(--np-text-muted)] text-[13px] mb-6">
              {result.error ?? "This invitation link is invalid or has expired."}
            </p>
            <a
              href="/dashboard"
              className="
                inline-flex items-center justify-center w-full h-9
                rounded-[var(--np-radius-md)]
                border border-[var(--np-border)]
                text-[var(--np-text-body)] text-[13px]
                hover:border-[var(--np-border-strong)] transition-colors
              "
            >
              Go to dashboard
            </a>
          </>
        )}
      </div>
    </div>
  )
}
