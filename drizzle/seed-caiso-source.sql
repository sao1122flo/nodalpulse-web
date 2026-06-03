-- T5: Seed 'caiso' source row required by CaisoAdapter.
-- run_adapter() will fail with "source 'caiso' not found" if this row is missing.
-- Apply via (from nodalpulse-web directory):
--   node scripts/apply-sql.mjs drizzle/seed-caiso-source.sql

INSERT INTO sources (slug, label, base_url) VALUES
  ('caiso', 'CAISO Regulatory Filings', 'https://www.caiso.com/legal-regulatory/regulatory-filings-orders/filings')
ON CONFLICT (slug) DO NOTHING;
