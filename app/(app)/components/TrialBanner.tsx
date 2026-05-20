import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { subscriptions } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function TrialBanner() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const [sub] = await db
    .select({
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1)

  if (sub?.status !== "trialing" || !sub.currentPeriodEnd) return null

  const daysLeft = Math.max(
    0,
    Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000),
  )

  return (
    <div
      className="
        mb-6 flex items-center justify-between gap-4
        rounded-[var(--np-radius-md)]
        border border-[var(--np-accent)] border-opacity-30
        bg-[var(--np-accent-fill)]
        px-4 py-2.5
      "
    >
      <p className="text-[13px] text-[var(--np-text-body)]">
        <span className="font-medium text-[var(--np-text-strong)]">Trial</span>
        {" — "}
        {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining` : "ends today"}
        . Card on file — no charge until trial ends.
      </p>
      <a
        href="/settings"
        className="flex-shrink-0 text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
      >
        Manage billing →
      </a>
    </div>
  )
}
