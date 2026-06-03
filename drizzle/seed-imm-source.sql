-- T9: Seed 'imm' source row required by ImmAdapter / handle_crawl_imm.
-- run_adapter() fails with "source 'imm' not found" if this row is missing.
-- Apply via (from nodalpulse-web directory):
--   node scripts/apply-sql.mjs drizzle/seed-imm-source.sql

INSERT INTO sources (slug, label, base_url) VALUES
  ('imm', 'PJM IMM (Monitoring Analytics)', 'https://www.monitoringanalytics.com/filings')
ON CONFLICT (slug) DO NOTHING;
