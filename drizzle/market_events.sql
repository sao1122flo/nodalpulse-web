-- T11: market_events — non-document deadline source for calendar/RSS-sourced events.
--
-- Ownership: services-only (written by crawl_pjm_calendar; read by compose_brief).
-- NOT web-owned — no drizzle schema entry, no Drizzle relations. Applied as raw SQL.
-- Q3 decision: brief composer in services is the sole reader; no web UI dashboard yet.
--
-- source values: 'pjm_rss' | 'auction_calendar' | 'stakeholder_page'
-- estimated=false → certain date from published PJM calendar or RSS.
-- estimated=true  → approximate window (e.g. "BRA expected May 2026").
--
-- Apply via (from nodalpulse-web directory):
--   node scripts/apply-sql.mjs drizzle/market_events.sql

CREATE TABLE IF NOT EXISTS market_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text        NOT NULL,
  jurisdiction   text        NOT NULL DEFAULT 'PJM-FERC',
  event_type     text        NOT NULL,
  title          text        NOT NULL,
  event_date     date        NOT NULL,
  estimated      boolean     NOT NULL DEFAULT false,
  related_docket text,
  source_url     text,
  external_id    text        UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_events_jurisdiction_date
  ON market_events (jurisdiction, event_date);

CREATE INDEX IF NOT EXISTS idx_market_events_event_date
  ON market_events (event_date DESC);
