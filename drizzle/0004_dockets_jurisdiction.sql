-- T3: Add jurisdiction column to dockets.
--
-- Ownership: dockets is a drizzle-owned table (nodalpulse-web/db/schema/index.ts).
-- Applied as Step B (handwritten SQL) due to snapshot drift from prior hand-applied
-- migrations. Once the drizzle journal is reconciled post-T3, future schema changes
-- go through: drizzle-kit generate --name <descriptive> && drizzle-kit migrate.
--
-- Apply via (from nodalpulse-web directory):
--   railway run --service nodalpulse-web psql "$DATABASE_URL" < drizzle/0004_dockets_jurisdiction.sql
-- Note: --service nodalpulse-web injects DATABASE_URL as a Railway reference link.
--       Never apply via the Railway web SQL console (silently drops DDL).

ALTER TABLE dockets
  ADD COLUMN IF NOT EXISTS jurisdiction text;

-- Backfill existing rows from their source slug.
-- CAISO-FERC and PJM-FERC rows do not exist yet; they will be stamped on creation.
UPDATE dockets
SET jurisdiction = CASE s.slug
    WHEN 'puct'       THEN 'PUCT'
    WHEN 'ercot-nprr' THEN 'ERCOT'
    WHEN 'ercot-mn'   THEN 'ERCOT'
    WHEN 'ferc'       THEN 'FERC'
    WHEN 'tlo'        THEN 'PUCT'
    ELSE s.slug
  END
FROM sources s
WHERE dockets.source_id = s.id
  AND dockets.jurisdiction IS NULL;

-- Index for market-scoped queries (web app docket list, brief aggregation).
CREATE INDEX IF NOT EXISTS idx_dockets_jurisdiction ON dockets (jurisdiction);
