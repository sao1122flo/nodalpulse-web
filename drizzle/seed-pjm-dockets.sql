-- T8: Bootstrap seed for hot PJM-FERC dockets.
--
-- PJM's filings index is JS-walled so there is no self-bootstrapping index
-- adapter (unlike CAISO). These 6 dockets are the live, contested proceedings
-- that define the current PJM regulatory environment. The RSS discovery pump
-- in handle_crawl_pjm will extend the set automatically going forward.
--
-- Dockets:
--   ER25-1357  RPM capacity auction price cap/floor (the marquee data-center fight)
--   EL25-49    Co-located load / data-center interconnection complaint
--   EL25-46    Co-located load complaint (companion to EL25-49)
--   ER24-2236  RTEP transmission planning protocol
--   ER24-2238  RTEP protocol (companion docket)
--   EL24-119   RTEP cost allocation complaint
--
-- Apply via (from nodalpulse-web directory):
--   node scripts/apply-sql.mjs drizzle/seed-pjm-dockets.sql
-- The 'pjm' source row must exist first (seed-pjm-source.sql).

INSERT INTO dockets (source_id, external_id, status, jurisdiction)
SELECT
  s.id,
  d.external_id,
  'open',
  'PJM-FERC'
FROM
  sources s,
  (VALUES
    ('ER25-1357'),
    ('EL25-49'),
    ('EL25-46'),
    ('ER24-2236'),
    ('ER24-2238'),
    ('EL24-119')
  ) AS d(external_id)
WHERE s.slug = 'pjm'
ON CONFLICT (source_id, external_id) DO NOTHING;
