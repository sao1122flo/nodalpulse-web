import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { subscriptions, savedSearches } from "@/db/schema"
import { count, eq } from "drizzle-orm"
import { getEntitlements } from "@/lib/entitlements"
import { createPortalSession } from "./actions"

export const metadata: Metadata = { title: "Settings" }

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[var(--np-text-primary)] font-semibold text-[14px]">{title}</h2>
      {description && (
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">{description}</p>
      )}
    </div>
  )
}

function ComingSoonBadge() {
  return (
    <span
      className="
        inline-flex items-center px-2 py-0.5 rounded-full
        text-[11px] font-medium
        bg-[var(--np-surface-deep)] text-[var(--np-text-muted)]
        border border-[var(--np-border)]
      "
    >
      Coming soon
    </span>
  )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        rounded-[var(--np-radius-lg)] border border-[var(--np-border)]
        bg-[var(--np-surface-elevated)] px-5 py-5 mb-4
      "
    >
      {children}
    </div>
  )
}

function FieldRow({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--np-border)] last:border-0">
      <div>
        <span className="text-[var(--np-text-body)] text-[13px]">{label}</span>
        {note && (
          <p className="text-[var(--np-text-muted)] text-[11px] mt-0.5">{note}</p>
        )}
      </div>
      <span className="text-[var(--np-text-strong)] text-[13px] font-mono">{value}</span>
    </div>
  )
}

function formatPeriodEnd(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const params = await searchParams
  const checkoutDone = params.checkout === "success"

  const [[sub], ents, [{ searchCount }]] = await Promise.all([
    db
      .select({
        status: subscriptions.status,
        tier: subscriptions.tier,
        stripeCustomerId: subscriptions.stripeCustomerId,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id))
      .limit(1),
    getEntitlements(session.user.id),
    db.select({ searchCount: count() }).from(savedSearches).where(eq(savedSearches.userId, session.user.id)),
  ])

  return (
    <div className="px-8 py-8 max-w-2xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          Manage your account, notifications, and billing.
        </p>
      </div>

      {/* Profile */}
      <SettingsCard>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Profile" />
          <span className="text-[var(--np-text-muted)] text-[12px]">Edit profile coming soon</span>
        </div>
        <FieldRow
          label="Email"
          value={session.user.email}
          note="Cannot be changed — contact support"
        />
        <FieldRow
          label="Name"
          value={session.user.name ?? "—"}
        />
        <div className="flex items-center justify-between py-2.5">
          <span className="text-[var(--np-text-body)] text-[13px]">Tracked dockets</span>
          <a
            href="/dockets"
            className="text-[var(--np-accent-text)] text-[13px] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Manage &rarr;
          </a>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <span className="text-[var(--np-text-body)] text-[13px]">Saved searches</span>
          <span className="text-[var(--np-text-muted)] text-[12px]">
            {Number(searchCount)} of {ents.savedSearches.limit ?? "∞"} used
          </span>
        </div>
      </SettingsCard>

      {/* Notifications */}
      <SettingsCard>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="Notification preferences"
            description="Control how and when we send your regulatory briefs."
          />
          <ComingSoonBadge />
        </div>
        <p className="text-[var(--np-text-muted)] text-[13px]">
          Delivery time, frequency, and format controls will appear here.
        </p>
      </SettingsCard>

      {/* Billing */}
      <SettingsCard>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="Billing"
            description="Manage your subscription and payment method."
          />
          {checkoutDone && (
            <span
              className="
                inline-flex items-center px-2 py-0.5 rounded-full
                text-[11px] font-medium
                bg-[rgba(34,197,94,0.12)] text-[var(--np-success)]
                border border-[rgba(34,197,94,0.2)]
              "
            >
              Subscribed
            </span>
          )}
        </div>

        <div className="flex items-center justify-between py-2">
          {sub?.status === "active" ? (
            <>
              <div>
                <p className="text-[var(--np-text-body)] text-[13px] font-medium">
                  {sub.tier
                    ? `${sub.tier.charAt(0).toUpperCase()}${sub.tier.slice(1)} plan · Active`
                    : "Active subscription"}
                </p>
                {sub.currentPeriodEnd && (
                  <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                    Renews {formatPeriodEnd(sub.currentPeriodEnd)}
                  </p>
                )}
              </div>
              <form action={createPortalSession}>
                <button
                  type="submit"
                  className="
                    min-h-11 px-4 rounded-[var(--np-radius-md)]
                    border border-[var(--np-border)]
                    text-[var(--np-text-body)] text-[13px]
                    hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)]
                    transition-colors cursor-pointer
                  "
                >
                  Manage billing
                </button>
              </form>
            </>
          ) : sub?.status === "past_due" ? (
            <>
              <div>
                <p className="text-[var(--np-danger)] text-[13px] font-medium">
                  Payment past due
                </p>
                <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                  Please update your payment method to restore access.
                </p>
              </div>
              <form action={createPortalSession}>
                <button
                  type="submit"
                  className="
                    min-h-11 px-4 rounded-[var(--np-radius-md)]
                    border border-[rgba(239,68,68,0.4)]
                    text-[var(--np-danger)] text-[13px]
                    hover:border-[rgba(239,68,68,0.7)]
                    transition-colors cursor-pointer
                  "
                >
                  Update payment
                </button>
              </form>
            </>
          ) : sub?.status === "cancelled" ? (
            <>
              <div>
                <p className="text-[var(--np-text-body)] text-[13px] font-medium">
                  Subscription cancelled
                </p>
                {sub.currentPeriodEnd && (
                  <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                    Access until {formatPeriodEnd(sub.currentPeriodEnd)}
                  </p>
                )}
              </div>
              <a
                href="/pricing"
                className="
                  min-h-11 px-4 rounded-[var(--np-radius-md)]
                  border border-[var(--np-accent)]
                  text-[var(--np-accent-text)] text-[13px]
                  hover:bg-[var(--np-accent)] hover:text-white
                  transition-colors inline-flex items-center
                "
              >
                Resubscribe
              </a>
            </>
          ) : (
            <>
              <div>
                <p className="text-[var(--np-text-body)] text-[13px] font-medium">
                  Free trial
                </p>
                <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                  Subscribe to unlock full access.
                </p>
              </div>
              <a
                href="/pricing"
                className="
                  min-h-11 px-4 rounded-[var(--np-radius-md)]
                  border border-[var(--np-accent)]
                  text-[var(--np-accent-text)] text-[13px]
                  hover:bg-[var(--np-accent)] hover:text-white
                  transition-colors inline-flex items-center
                "
              >
                View plans
              </a>
            </>
          )}
        </div>
      </SettingsCard>

      {/* Danger zone */}
      <div
        className="
          rounded-[var(--np-radius-lg)] border border-[rgba(239,68,68,0.25)]
          bg-[rgba(239,68,68,0.04)] px-5 py-5
        "
      >
        <SectionHeader
          title="Danger zone"
          description="Irreversible actions. Proceed with caution."
        />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--np-text-body)] text-[13px] font-medium">Delete account</p>
            <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
              Permanently remove your account and all data.
            </p>
          </div>
          <button
            disabled
            title="Contact support to delete your account"
            className="
              h-8 px-4
              rounded-[var(--np-radius-md)]
              border border-[rgba(239,68,68,0.3)]
              text-[var(--np-danger)] text-[13px]
              opacity-40 cursor-not-allowed
            "
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  )
}
