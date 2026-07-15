import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { subscriptions, teamMemberships } from "@/db/schema"
import { and, eq, ne, count } from "drizzle-orm"
import { getEntitlements } from "@/lib/entitlements"
import { getQnaUsage } from "@/lib/services-client"
import { createPortalSession, listTeamMembers, listApiKeys, requestBriefExport, listEntities } from "./actions"
import { listSavedSearches } from "@/app/(app)/saved-searches/actions"
import { SavedSearchesSettings } from "./SavedSearchesSettings"
import { TeamInviteForm } from "./TeamInviteForm"
import { ApiKeysPanel } from "./ApiKeysPanel"
import { EntitiesSettings } from "./EntitiesSettings"

export const metadata: Metadata = { title: "Settings" }

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------
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

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-5 mb-4">
      {children}
    </div>
  )
}

function FieldRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--np-border)] last:border-0">
      <div>
        <span className="text-[var(--np-text-body)] text-[13px]">{label}</span>
        {note && <p className="text-[var(--np-text-muted)] text-[11px] mt-0.5">{note}</p>}
      </div>
      <span className="text-[var(--np-text-strong)] text-[13px] font-mono">{value}</span>
    </div>
  )
}

function formatPeriodEnd(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
}

// ---------------------------------------------------------------------------
// Tab nav
// ---------------------------------------------------------------------------
function TabNav({
  active,
  showTeam,
  showApi,
  showData,
}: {
  active: string
  showTeam: boolean
  showApi: boolean
  showData: boolean
}) {
  const tabs = [
    { key: "profile",   label: "Profile" },
    { key: "billing",   label: "Billing" },
    { key: "entities",  label: "Entities" },
    ...(showTeam ? [{ key: "team", label: "Team" }] : []),
    ...(showApi  ? [{ key: "api",  label: "API"  }] : []),
    ...(showData ? [{ key: "data", label: "Data" }] : []),
  ]

  return (
    <nav className="flex items-center gap-0.5 border-b border-[var(--np-border)] mb-6 -mx-1 px-1">
      {tabs.map(t => (
        <a
          key={t.key}
          href={`/settings?tab=${t.key}`}
          className={`
            px-3 py-2 text-[13px] font-medium rounded-t-[4px]
            border-b-2 -mb-[1px] transition-colors
            ${active === t.key
              ? "border-[var(--np-accent)] text-[var(--np-text-primary)]"
              : "border-transparent text-[var(--np-text-muted)] hover:text-[var(--np-text-body)]"
            }
          `}
        >
          {t.label}
        </a>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const VALID_TABS = ["profile", "billing", "entities", "team", "api", "data"] as const
type Tab = typeof VALID_TABS[number]

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; checkout?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const params = await searchParams
  const rawTab = params.tab ?? "profile"
  const tab: Tab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as Tab)
    : "profile"
  const checkoutDone = params.checkout === "success"
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  // Always fetch entitlements (tab visibility depends on it).
  const ents = await getEntitlements(session.user.id)

  const showTeam = ents.teamSeats.limit > 1
  const showApi  = ents.apiAccess
  const showData = ents.auditExport

  // Per-tab data fetching.
  const subPromise =
    tab === "billing"
      ? db
          .select({
            status:           subscriptions.status,
            tier:             subscriptions.tier,
            stripeCustomerId: subscriptions.stripeCustomerId,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
          })
          .from(subscriptions)
          .where(eq(subscriptions.userId, session.user.id))
          .limit(1)
      : Promise.resolve([])

  const savedSearchPromise =
    tab === "profile" ? listSavedSearches() : Promise.resolve([])

  const qnaUsagePromise =
    tab === "profile"
      ? getQnaUsage(session.user.id).catch(() => null)
      : Promise.resolve(null)

  const membersPromise =
    tab === "team" && showTeam ? listTeamMembers() : Promise.resolve([])

  const entitiesPromise =
    tab === "entities" ? listEntities() : Promise.resolve([])

  const apiKeysPromise =
    tab === "api" && showApi ? listApiKeys() : Promise.resolve([])

  const usedSeatsCountPromise =
    tab === "team" && showTeam
      ? db
          .select({ total: count() })
          .from(teamMemberships)
          .where(
            and(
              eq(teamMemberships.ownerId, session.user.id),
              ne(teamMemberships.status, "revoked"),
            )
          )
      : Promise.resolve([{ total: 0 }])

  const [subRows, savedSearchRows, qnaUsageResult, members, entityRows, apiKeyRows, [usedSeatsRow]] =
    await Promise.all([
      subPromise,
      savedSearchPromise,
      qnaUsagePromise,
      membersPromise,
      entitiesPromise,
      apiKeysPromise,
      usedSeatsCountPromise,
    ])

  const sub = subRows[0] ?? null
  const qnaUsedToday = qnaUsageResult?.ok ? qnaUsageResult.value.used_today : null
  const usedSeats = Number(usedSeatsRow?.total ?? 0)

  return (
    <div className="px-8 py-8 max-w-2xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-[var(--np-text-muted)] text-[13px] mt-0.5">
          Manage your account, billing, and team.
        </p>
      </div>

      <TabNav active={tab} showTeam={showTeam} showApi={showApi} showData={showData} />

      {/* ── Profile tab ── */}
      {tab === "profile" && (
        <>
          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Profile" />
              <span className="text-[var(--np-text-muted)] text-[12px]">Edit profile coming soon</span>
            </div>
            <FieldRow label="Email" value={session.user.email} note="Cannot be changed — contact support" />
            <FieldRow label="Name" value={session.user.name ?? "—"} />
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[var(--np-text-body)] text-[13px]">Tracked dockets</span>
              <Link href="/dockets" className="text-[var(--np-accent-text)] text-[13px] hover:text-[var(--np-accent-hover)] transition-colors">
                Manage &rarr;
              </Link>
            </div>
            <div className="py-2.5 border-b border-[var(--np-border)]">
              <p className="text-[var(--np-text-body)] text-[13px] mb-2">Saved searches</p>
              {ents.savedSearches.limit === 0 ? (
                <div className="flex items-center justify-between">
                  <p className="text-[var(--np-text-muted)] text-[12px]">Available on paid plans.</p>
                  <a href="/pricing" className="text-[var(--np-accent-text)] text-[12px] hover:text-[var(--np-accent-hover)] transition-colors">View plans →</a>
                </div>
              ) : (
                <SavedSearchesSettings initialSearches={savedSearchRows} limit={ents.savedSearches.limit} />
              )}
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div>
                <span className="text-[var(--np-text-body)] text-[13px]">Ask the Record</span>
                {ents.aiActions.perMonth !== null && ents.aiActions.perMonth > 0 && (
                  <p className="text-[var(--np-text-muted)] text-[11px] mt-0.5">
                    {qnaUsedToday !== null
                      ? `${qnaUsedToday} of ${ents.aiActions.perMonth} AI actions used this month`
                      : `${ents.aiActions.perMonth} AI actions/month`}
                  </p>
                )}
              </div>
              {ents.aiActions.perMonth === 0 ? (
                <a href="/pricing" className="text-[var(--np-accent-text)] text-[12px] hover:text-[var(--np-accent-hover)] transition-colors">View plans →</a>
              ) : (
                <a href="/chat" className="text-[var(--np-accent-text)] text-[13px] hover:text-[var(--np-accent-hover)] transition-colors">Open Q&amp;A →</a>
              )}
            </div>
          </SettingsCard>

          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Notification preferences" description="Control how and when we send your regulatory briefs." />
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--np-surface-deep)] text-[var(--np-text-muted)] border border-[var(--np-border)]">
                Coming soon
              </span>
            </div>
            <p className="text-[var(--np-text-muted)] text-[13px]">
              Delivery time, frequency, and format controls will appear here.
            </p>
          </SettingsCard>
        </>
      )}

      {/* ── Billing tab ── */}
      {tab === "billing" && (
        <>
          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Billing" description="Manage your subscription and payment method." />
              {checkoutDone && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[rgba(34,197,94,0.12)] text-[var(--np-success)] border border-[rgba(34,197,94,0.2)]">
                  Subscribed
                </span>
              )}
            </div>

            <div className="flex items-center justify-between py-2">
              {sub?.status === "trialing" ? (
                <>
                  <div>
                    <p className="text-[var(--np-text-body)] text-[13px] font-medium">
                      {sub.tier ? `${sub.tier.charAt(0).toUpperCase()}${sub.tier.slice(1)} plan · Trial` : "Trial"}
                    </p>
                    {sub.currentPeriodEnd && (
                      <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
                        {Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now) / 86_400_000))} days remaining
                        · trial ends {formatPeriodEnd(sub.currentPeriodEnd)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <a href="/pricing" className="text-[var(--np-accent-text)] text-[13px] hover:underline transition-colors">Upgrade plan →</a>
                    <form action={createPortalSession}>
                      <button type="submit" className="min-h-11 px-4 rounded-[var(--np-radius-md)] border border-[var(--np-border)] text-[var(--np-text-body)] text-[13px] hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)] transition-colors cursor-pointer">
                        Manage billing
                      </button>
                    </form>
                  </div>
                </>
              ) : sub?.status === "active" ? (
                <>
                  <div>
                    <p className="text-[var(--np-text-body)] text-[13px] font-medium">
                      {sub.tier ? `${sub.tier.charAt(0).toUpperCase()}${sub.tier.slice(1)} plan · Active` : "Active subscription"}
                    </p>
                    {sub.currentPeriodEnd && (
                      <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">Renews {formatPeriodEnd(sub.currentPeriodEnd)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <a href="/pricing" className="text-[var(--np-accent-text)] text-[13px] hover:underline transition-colors">Change plan →</a>
                    <form action={createPortalSession}>
                      <button type="submit" className="min-h-11 px-4 rounded-[var(--np-radius-md)] border border-[var(--np-border)] text-[var(--np-text-body)] text-[13px] hover:border-[var(--np-border-strong)] hover:text-[var(--np-text-strong)] transition-colors cursor-pointer">
                        Manage billing
                      </button>
                    </form>
                  </div>
                </>
              ) : sub?.status === "past_due" ? (
                <>
                  <div>
                    <p className="text-[var(--np-danger)] text-[13px] font-medium">Payment past due</p>
                    <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">Update your payment method to restore access.</p>
                  </div>
                  <form action={createPortalSession}>
                    <button type="submit" className="min-h-11 px-4 rounded-[var(--np-radius-md)] border border-[rgba(239,68,68,0.4)] text-[var(--np-danger)] text-[13px] hover:border-[rgba(239,68,68,0.7)] transition-colors cursor-pointer">
                      Update payment
                    </button>
                  </form>
                </>
              ) : sub?.status === "cancelled" ? (
                <>
                  <div>
                    <p className="text-[var(--np-text-body)] text-[13px] font-medium">Subscription cancelled</p>
                    {sub.currentPeriodEnd && (
                      <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">Access until {formatPeriodEnd(sub.currentPeriodEnd)}</p>
                    )}
                  </div>
                  <a href="/pricing" className="min-h-11 px-4 rounded-[var(--np-radius-md)] border border-[var(--np-accent)] text-[var(--np-accent-text)] text-[13px] hover:bg-[var(--np-accent)] hover:text-white transition-colors inline-flex items-center">
                    Resubscribe
                  </a>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-[var(--np-text-body)] text-[13px] font-medium">Free plan</p>
                    <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">Subscribe to unlock full access.</p>
                  </div>
                  <a href="/pricing" className="min-h-11 px-4 rounded-[var(--np-radius-md)] border border-[var(--np-accent)] text-[var(--np-accent-text)] text-[13px] hover:bg-[var(--np-accent)] hover:text-white transition-colors inline-flex items-center">
                    View plans
                  </a>
                </>
              )}
            </div>
          </SettingsCard>

          {/* Market add-ons */}
          {sub && (sub.status === "active" || sub.status === "trialing") && (
            <SettingsCard>
              <SectionHeader
                title="Market access"
                description="Regulatory markets included in your plan."
              />
              <div className="flex flex-wrap gap-1.5 mb-4">
                {ents.marketAccess.length === 0 ? (
                  <span className="text-[var(--np-text-muted)] text-[13px]">No markets configured.</span>
                ) : ents.marketAccess.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--np-indigo-50)] text-[#312e81] border border-[rgba(99,102,241,0.2)]"
                  >
                    {m === "CAISO" ? "California (CAISO)" : m === "PJM" ? "PJM Wholesale" : m === "PUCT" ? "Texas (PUCT)" : m === "ERCOT" ? "Texas (ERCOT)" : m}
                  </span>
                ))}
              </div>
              {/* Market add-ons removed: every market is included on every plan. */}
            </SettingsCard>
          )}

          {/* Danger zone */}
          <div className="rounded-[var(--np-radius-lg)] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.04)] px-5 py-5">
            <SectionHeader title="Danger zone" description="Irreversible actions. Proceed with caution." />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--np-text-body)] text-[13px] font-medium">Delete account</p>
                <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">Permanently remove your account and all data.</p>
              </div>
              <button
                disabled
                title="Contact support to delete your account"
                className="h-8 px-4 rounded-[var(--np-radius-md)] border border-[rgba(239,68,68,0.3)] text-[var(--np-danger)] text-[13px] opacity-40 cursor-not-allowed"
              >
                Delete account
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Entities tab ── */}
      {tab === "entities" && (
        <SettingsCard>
          <SectionHeader
            title="Entity watch list"
            description="Names we scan for in new FERC, PJM, and CAISO filings — surfaced in your daily brief and dashboard."
          />
          <EntitiesSettings initialEntities={entityRows} />
        </SettingsCard>
      )}

      {/* ── Team tab ── */}
      {tab === "team" && (
        showTeam ? (
          <SettingsCard>
            <SectionHeader
              title="Team members"
              description={`Invite colleagues to your NodalPulse team. Your plan includes ${ents.teamSeats.limit} seats.`}
            />
            <TeamInviteForm
              members={members}
              seatLimit={ents.teamSeats.limit}
              usedSeats={usedSeats}
            />
          </SettingsCard>
        ) : (
          <SettingsCard>
            <SectionHeader title="Team members" />
            <p className="text-[var(--np-text-muted)] text-[13px] mb-3">
              Team seat management is available on Team plan and above.
            </p>
            <a
              href="/pricing"
              className="
                inline-flex items-center h-9 px-4
                rounded-[var(--np-radius-md)]
                border border-[var(--np-accent)]
                text-[var(--np-accent-text)] text-[13px]
                hover:bg-[var(--np-accent)] hover:text-white transition-colors
              "
            >
              View plans
            </a>
          </SettingsCard>
        )
      )}

      {/* ── API tab ── */}
      {tab === "api" && (
        showApi ? (
          <SettingsCard>
            <SectionHeader
              title="API keys"
              description="Create keys to authenticate requests to the NodalPulse API. Keys are shown once — store them securely."
            />
            <ApiKeysPanel keys={apiKeyRows} />
          </SettingsCard>
        ) : (
          <SettingsCard>
            <SectionHeader title="API access" />
            <p className="text-[var(--np-text-muted)] text-[13px] mb-3">API access is available on the Org plan.</p>
            <a href="/pricing" className="inline-flex items-center h-9 px-4 rounded-[var(--np-radius-md)] border border-[var(--np-accent)] text-[var(--np-accent-text)] text-[13px] hover:bg-[var(--np-accent)] hover:text-white transition-colors">
              View plans
            </a>
          </SettingsCard>
        )
      )}

      {/* ── Data tab ── */}
      {tab === "data" && (
        showData ? (
          <SettingsCard>
            <SectionHeader
              title="Brief history export"
              description="Download all your sent briefs as an HTML archive. You'll receive an email with a download link when the export is ready."
            />
            <form action={async () => { await requestBriefExport() }}>
              <button
                type="submit"
                className="
                  h-9 px-4 rounded-[var(--np-radius-md)]
                  bg-[var(--np-accent)] text-[var(--np-accent-fg)]
                  text-[13px] font-medium
                  hover:bg-[var(--np-accent-hover)] transition-colors
                  cursor-pointer
                "
              >
                Request export
              </button>
            </form>
            <p className="text-[var(--np-text-muted)] text-[12px] mt-3">
              The archive includes one HTML file per brief and a manifest.json index.
              The download link expires after 24 hours.
            </p>
          </SettingsCard>
        ) : (
          <SettingsCard>
            <SectionHeader title="Data export" />
            <p className="text-[var(--np-text-muted)] text-[13px] mb-3">Audit export is available on the Org plan.</p>
            <a href="/pricing" className="inline-flex items-center h-9 px-4 rounded-[var(--np-radius-md)] border border-[var(--np-accent)] text-[var(--np-accent-text)] text-[13px] hover:bg-[var(--np-accent)] hover:text-white transition-colors">
              View plans
            </a>
          </SettingsCard>
        )
      )}
    </div>
  )
}
