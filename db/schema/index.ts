import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  json,
  jsonb,
  numeric,
  index,
  unique,
} from "drizzle-orm/pg-core"

// Matches the JSONB payload written by services' extraction worker (schema_ver "1.1",
// prompt_ver "1.6"+). actor / party_role / docket_linkages are prompt_ver 1.6 additions —
// optional so older (1.0/1.5) extractions still type-check.
export interface ExtractionDeadline {
  type?:       string          // hearing|compliance|comment_deadline|rehearing|effective_date|protest_notice|other
  description: string
  date:        string | null   // ISO date or null
  source?:     string          // filing|order|notice
  estimated?:  boolean
  verify_url?: string | null
  actor?:      string | null   // who must act (1.6+): Applicant|Intervenors|Staff|ALJ|…
}

export interface ExtractionIntervention {
  party:       string
  stance:      "support" | "oppose" | "comments" | "protest"
  party_role?: string | null   // applicant|intervenor|protestant|staff|commenter (1.6+)
}

export interface DocketLinkage {
  docket: string
  reason: string
}

export interface ExtractionPayload {
  docket_number?:    string | null
  summary?:          string | null
  parties?:          string[]
  deadlines?:        ExtractionDeadline[]
  interventions?:    ExtractionIntervention[]
  docket_linkages?:  DocketLinkage[]   // explicitly-referenced related dockets (1.6+)
  effective_date?:   string | null
  key_points?:       string[]
  relief_requested?: string | null
  outcome?:          string | null
  role_tags?:        string[]
  // CAISO-specific
  initiative_name?:  string | null
  cpuc_proceeding_refs?: string[]
  // PJM-specific (sector_vote and rpm_parameters are untyped for now)
  sector_vote?:      Record<string, unknown> | null
  rpm_parameters?:   Record<string, unknown> | null
  rtep_cost_allocation?: { zone: string; dollars: number | null }[]
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
})

// ---------------------------------------------------------------------------
// verifications
// ---------------------------------------------------------------------------
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// ---------------------------------------------------------------------------
// user_profiles
// ---------------------------------------------------------------------------
export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  marketRoles: text("market_roles").array().notNull().default([]),
  trackedDocketIds: uuid("tracked_docket_ids").array().notNull().default([]),
  trackedTags: json("tracked_tags").$type<string[]>().notNull().default([]),
  emailFormat: text("email_format").notNull().default("html"),
  onboardingStep: integer("onboarding_step").notNull().default(0),
})

// ---------------------------------------------------------------------------
// saved_searches
// ---------------------------------------------------------------------------

export interface SavedSearchQuery {
  markets?: string[]
  tdu_zones?: string[]
  tags?: string[]
  docket_ids?: string[]
  text?: string
}

export const savedSearches = pgTable(
  "saved_searches",
  {
    id:          uuid("id").defaultRandom().primaryKey(),
    userId:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name:        text("name").notNull(),
    query:       jsonb("query").$type<SavedSearchQuery>().notNull().default({}),
    notify:      boolean("notify").notNull().default(true),
    createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  },
  (t) => [
    unique("saved_searches_user_name_unique").on(t.userId, t.name),
    index("saved_searches_user_created_idx").on(t.userId, t.createdAt),
  ],
)

// ---------------------------------------------------------------------------
// entitlements
// ---------------------------------------------------------------------------
// source: 'tier' = written by webhook from Stripe base-tier item (recomputed on every sub event)
//         'addon' = written by webhook from Stripe add-on subscription item (recomputed on every sub event)
//         'beta_grandfather' = manually granted; never touched by the webhook recompute
export const entitlements = pgTable("entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  feature: text("feature").notNull(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow(),
  source: text("source").notNull().default("tier"),
})

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("trialing"),
  tier: text("tier"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// ---------------------------------------------------------------------------
// briefs
// ---------------------------------------------------------------------------
export const briefs = pgTable("briefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  date: date("date").notNull(),
  model: text("model"),
  promptVer: text("prompt_ver"),
  htmlR2Key: text("html_r2_key"),
  txtR2Key: text("txt_r2_key"),
  filingIds: uuid("filing_ids").array().notNull().default([]),
  citationCount: integer("citation_count").notNull().default(0),
  sendStatus: text("send_status").notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ---------------------------------------------------------------------------
// accounts (OAuth provider links — managed by better-auth)
// ---------------------------------------------------------------------------
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// admin_actions (audit log for /__admin surface)
// ---------------------------------------------------------------------------
export const adminActions = pgTable("admin_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorEmailHash: text("actor_email_hash").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// health_checks (preserved from original)
// ---------------------------------------------------------------------------
export const healthChecks = pgTable("health_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// dockets
// Shared: web creates user-tracked entries; services will link filings via
// filings.docket_id as the pipeline matures. source_id encodes jurisdiction
// (puct / ercot-nprr / ercot-mn). Phase 12a: web only writes PUCT rows.
// ---------------------------------------------------------------------------
export const dockets = pgTable("dockets", {
  id:           uuid("id").defaultRandom().primaryKey(),
  sourceId:     uuid("source_id").notNull(),
  externalId:   text("external_id").notNull(),
  title:        text("title"),
  status:       text("status").notNull().default("open"),
  // Market/regulator identifier, e.g. "PUCT", "ERCOT", "FERC", "CAISO-FERC", "PJM-FERC".
  // Nullable for rows that predate T3; backfilled in migration 0004_dockets_jurisdiction.sql.
  // New rows are stamped at create time via find_or_create_docket().
  jurisdiction: text("jurisdiction"),
  openedAt:     date("opened_at"),
  closedAt:     date("closed_at"),
  metadata:     jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// user_dockets
// ---------------------------------------------------------------------------
export const userDockets = pgTable("user_dockets", {
  id:        uuid("id").defaultRandom().primaryKey(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  docketId:  uuid("docket_id").notNull().references(() => dockets.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// team_memberships
// ---------------------------------------------------------------------------
export const teamMemberships = pgTable(
  "team_memberships",
  {
    id:            uuid("id").defaultRandom().primaryKey(),
    ownerId:       uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail:  text("invitee_email").notNull(),
    inviteeUserId: uuid("invitee_user_id").references(() => users.id, { onDelete: "set null" }),
    role:          text("role").notNull().default("member"),
    // status: pending | accepted | revoked
    status:        text("status").notNull().default("pending"),
    invitedAt:     timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt:    timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    unique("team_memberships_owner_email_unique").on(t.ownerId, t.inviteeEmail),
    index("idx_team_memberships_owner").on(t.ownerId),
    index("idx_team_memberships_invitee_email").on(t.inviteeEmail),
  ],
)

// ---------------------------------------------------------------------------
// api_keys
// Format: np_<8-char-prefix>_<32-char-random-suffix>
// The prefix is stored plaintext for O(1) lookup; the full key is hashed.
// ---------------------------------------------------------------------------
export const apiKeys = pgTable("api_keys", {
  id:         uuid("id").defaultRandom().primaryKey(),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label:      text("label").notNull(),
  keyPrefix:  text("key_prefix").notNull(),
  keyHash:    text("key_hash").notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt:  timestamp("revoked_at", { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// watched_entities — per-user entity watch list for Discovery (#85)
// Web owns writes; services reads for entity-match in compose_brief.
// ---------------------------------------------------------------------------
export const watchedEntities = pgTable(
  "watched_entities",
  {
    id:        uuid("id").defaultRandom().primaryKey(),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name:      text("name").notNull(),
    aliases:   text("aliases").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("watched_entities_user_name_unique").on(t.userId, t.name),
    index("idx_watched_entities_user_id").on(t.userId),
  ],
)

// ---------------------------------------------------------------------------
// watched_themes — per-user subscription to a shared curated theme (B3).
// References the services-owned `themes` taxonomy by its stable `key` slug
// (no cross-repo FK). Web owns writes; services classification is global.
// ---------------------------------------------------------------------------
export const watchedThemes = pgTable(
  "watched_themes",
  {
    id:        uuid("id").defaultRandom().primaryKey(),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    themeKey:  text("theme_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("watched_themes_user_theme_unique").on(t.userId, t.themeKey),
    index("idx_watched_themes_user_id").on(t.userId),
  ],
)

// ---------------------------------------------------------------------------
// discovery_dismissals — per-user "not relevant" on a discovery_feed item (B3).
// References discovery_feed by accession (services-owned; no cross-repo FK).
// Hides the item AND feeds matcher tuning.
// ---------------------------------------------------------------------------
export const discoveryDismissals = pgTable(
  "discovery_dismissals",
  {
    id:        uuid("id").defaultRandom().primaryKey(),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accession: text("accession").notNull(),
    reason:    text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("discovery_dismissals_user_accession_unique").on(t.userId, t.accession),
    index("idx_discovery_dismissals_user_id").on(t.userId),
  ],
)

// ---------------------------------------------------------------------------
// theme_requests — user asks for a theme we don't curate yet (B3). Does NOT
// classify per-user; we curate manually. Captures demand signal.
// ---------------------------------------------------------------------------
export const themeRequests = pgTable(
  "theme_requests",
  {
    id:        uuid("id").defaultRandom().primaryKey(),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label:     text("label").notNull(),
    note:      text("note"),
    status:    text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_theme_requests_user_id").on(t.userId)],
)

// ---------------------------------------------------------------------------
// digest_leads — public digest email subscribers (#122)
// ---------------------------------------------------------------------------
export const digestLeads = pgTable(
  "digest_leads",
  {
    id:        uuid("id").defaultRandom().primaryKey(),
    email:     text("email").notNull(),
    source:    text("source").notNull().default("digest_page"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("digest_leads_email_unique").on(t.email),
    index("idx_digest_leads_created_at").on(t.createdAt),
  ],
)

// READ-ONLY from nodalpulse-web.
// Owner: nodalpulse-services. Do not write to these tables from the web app
// except where explicitly noted (dockets above is a shared-write exception).
// ---------------------------------------------------------------------------

// filings — subset of columns used by docket detail queries.
export const filings = pgTable("filings", {
  id:         uuid("id").defaultRandom().primaryKey(),
  sourceId:   uuid("source_id").notNull(),
  externalId: text("external_id").notNull(),
  docketId:   uuid("docket_id"),
  docType:    text("doc_type").notNull(),
  title:      text("title").notNull(),
  filer:      text("filer"),
  filedAt:    timestamp("filed_at", { withTimezone: true }).notNull(),
  sourceUrl:  text("source_url"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull(),
})

// filing_dockets — many-to-many junction written by services; READ-ONLY from web.
// is_primary marks the first docket in a multi-caption filing (matches filings.docket_id).
export const filingDockets = pgTable(
  "filing_dockets",
  {
    id:        uuid("id").defaultRandom().primaryKey(),
    filingId:  uuid("filing_id").notNull().references(() => filings.id, { onDelete: "cascade" }),
    docketId:  uuid("docket_id").notNull().references(() => dockets.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("filing_dockets_filing_docket_unique").on(t.filingId, t.docketId),
    index("idx_filing_dockets_filing_id").on(t.filingId),
    index("idx_filing_dockets_docket_id").on(t.docketId),
  ],
)

// extractions — subset of columns; payload typed against ExtractionPayload.
export const extractions = pgTable("extractions", {
  id:          uuid("id").defaultRandom().primaryKey(),
  filingId:    uuid("filing_id").notNull(),
  schemaVer:   text("schema_ver").notNull(),
  payload:     jsonb("payload").$type<ExtractionPayload>().notNull().default({}),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull(),
})

// ---------------------------------------------------------------------------
// READ-ONLY from nodalpulse-web.
// Owner: nodalpulse-services. Do not write to this table from the web app.
// If you need to mutate it, route the request through the services API.
// ---------------------------------------------------------------------------
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  priority: integer("priority").notNull().default(0),
  runAfter: timestamp("run_after", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lockedBy: text("locked_by"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

// READ-ONLY from nodalpulse-web.
// Owner: nodalpulse-services. Do not write to this table from the web app.
// If you need to mutate it, route the request through the services API.
export const jobResults = pgTable("job_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  success: boolean("success").notNull(),
  output: jsonb("output").$type<Record<string, unknown>>().notNull().default({}),
  durationMs: integer("duration_ms"),
  finishedAt: timestamp("finished_at", { withTimezone: true }).defaultNow().notNull(),
})

// READ-ONLY from nodalpulse-web.
// Owner: nodalpulse-services. Do not write to this table from the web app.
// If you need to mutate it, route the request through the services API.
export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
  model: text("model").notNull(),
  promptVer: text("prompt_ver").notNull(),
  taxonomyVer: text("taxonomy_ver").notNull(),
  goldenSetSize: integer("golden_set_size").notNull(),
  results: jsonb("results").$type<Record<string, unknown>>().notNull(),
  overallAccuracy: numeric("overall_accuracy"),
  passed: boolean("passed").notNull(),
  failedTags: text("failed_tags").array().notNull().default([]),
  triggeredAlert: boolean("triggered_alert").notNull().default(false),
})
