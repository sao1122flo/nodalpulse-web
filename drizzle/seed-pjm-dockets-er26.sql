-- T11-verify: seed ER26-455 as the echo-test RPM docket.
--
-- ER26-455 is PJM's collar extension filing (Feb 2026, accepted FERC Apr 28 2026)
-- for delivery years 2028/2029 and 2029/2030. Cap ~$325/MW-day, floor ~$175/MW-day —
-- DIFFERENT from ER25-1357 few-shot anchors (329.17/177.24), so extraction results
-- prove the LLM is reading the document, not echoing the prompt.
--
-- Apply via:
--   node scripts/apply-sql.mjs drizzle/seed-pjm-dockets-er26.sql

INSERT INTO dockets (source_id, external_id, status, jurisdiction)
SELECT s.id, 'ER26-455', 'open', 'PJM-FERC'
FROM   sources s
WHERE  s.slug = 'pjm'
ON CONFLICT (source_id, external_id) DO NOTHING;
