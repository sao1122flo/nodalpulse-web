-- T8: Seed 'pjm' source row required by handle_crawl_pjm.
-- run_adapter() fails with "source 'pjm' not found" if this row is missing.
-- Apply via (from nodalpulse-web directory):
--   node scripts/apply-sql.mjs drizzle/seed-pjm-source.sql

INSERT INTO sources (slug, label, base_url) VALUES
  ('pjm', 'PJM FERC Filings', 'https://elibrary.ferc.gov')
ON CONFLICT (slug) DO NOTHING;
