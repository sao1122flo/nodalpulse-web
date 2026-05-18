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

// Matches the JSONB payload written by services' extraction worker (schema_ver "1.0").
export interface ExtractionPayload {
  docket_number?:  string | null
  summary?:        string | null
  parties?:        string[]
  deadlines?:      { description: string; date: string | null }[]
  effective_date?: string | null
  key_points?:     string[]
  relief_requested?: string | null
  outcome?:        string | null
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
export const entitlements = pgTable("entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  feature: text("feature").notNull(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow(),
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
  id:         uuid("id").defaultRandom().primaryKey(),
  sourceId:   uuid("source_id").notNull(),
  externalId: text("external_id").notNull(),
  title:      text("title"),
  status:     text("status").notNull().default("open"),
  openedAt:   date("opened_at"),
  closedAt:   date("closed_at"),
  metadata:   jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
// READ-ONLY from nodalpulse-web.
// Owner: nodalpulse-services. Do not write to these tables from the web app
// except where explicitly noted (dockets above is a shared-write exception).
// ---------------------------------------------------------------------------

// filings — subset of columns used by docket detail queries.
export const filings = pgTable("filings", {
  id:        uuid("id").defaultRandom().primaryKey(),
  sourceId:  uuid("source_id").notNull(),
  docketId:  uuid("docket_id"),
  docType:   text("doc_type").notNull(),
  title:     text("title").notNull(),
  filer:     text("filer"),
  filedAt:   timestamp("filed_at", { withTimezone: true }).notNull(),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
})

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
