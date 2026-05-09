import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

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

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

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
          <ComingSoonBadge />
        </div>
        <p className="text-[var(--np-text-muted)] text-[13px]">
          Upgrade plan coming soon — Stripe integration in progress.
        </p>
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
