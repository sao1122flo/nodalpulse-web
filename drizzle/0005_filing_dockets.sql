-- T4: filing<->docket many-to-many junction table.
-- Owner: nodalpulse-services (written by crawl pipeline). READ-ONLY from nodalpulse-web.
-- is_primary=true marks the first docket in a multi-caption filing (matches filings.docket_id).
--
-- Apply via (from nodalpulse-web directory):
--   railway run --service nodalpulse-web node scripts/apply-sql.mjs drizzle/0005_filing_dockets.sql

CREATE TABLE IF NOT EXISTS filing_dockets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id  uuid        NOT NULL REFERENCES filings(id)  ON DELETE CASCADE,
  docket_id  uuid        NOT NULL REFERENCES dockets(id)  ON DELETE CASCADE,
  is_primary boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT filing_dockets_filing_docket_unique UNIQUE (filing_id, docket_id)
);

CREATE INDEX IF NOT EXISTS idx_filing_dockets_filing_id ON filing_dockets (filing_id);
CREATE INDEX IF NOT EXISTS idx_filing_dockets_docket_id ON filing_dockets (docket_id);
