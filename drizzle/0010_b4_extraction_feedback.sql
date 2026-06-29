-- B4 — unified data-quality feedback store (web-owned).
-- One row per (user, item_type, item_ref). Going forward this is the single
-- store for all extracted-item feedback: discovery "not relevant" (hides) and
-- deadline/fact "report issue" (flagged but visible). References services-owned
-- rows by stable text key (accession / deadline hash) — no cross-repo FK.
-- Idempotent so it applies safely to the shared DB.

CREATE TABLE IF NOT EXISTS extraction_feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type   TEXT        NOT NULL,
  item_ref    TEXT        NOT NULL,
  docket_ref  TEXT,
  reason      TEXT,
  note        TEXT,
  hides_item  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT extraction_feedback_user_item_unique UNIQUE (user_id, item_type, item_ref)
);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_user_id ON extraction_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_type    ON extraction_feedback (item_type);

-- Forward fold-in of B3 discovery_dismissals (preserve the hide semantics).
-- No history rewrite: discovery_dismissals stays; new writes go here; the read
-- path now excludes via extraction_feedback so old dismissals keep hiding.
INSERT INTO extraction_feedback (user_id, item_type, item_ref, reason, hides_item, created_at)
SELECT user_id, 'discovery', accession, reason, true, created_at
FROM discovery_dismissals
ON CONFLICT (user_id, item_type, item_ref) DO NOTHING;
