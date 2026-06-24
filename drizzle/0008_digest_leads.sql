CREATE TABLE IF NOT EXISTS "digest_leads" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email"      text NOT NULL,
  "source"     text NOT NULL DEFAULT 'digest_page',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "digest_leads_email_unique"    ON "digest_leads" ("email");
CREATE INDEX        IF NOT EXISTS "idx_digest_leads_created_at" ON "digest_leads" ("created_at");
