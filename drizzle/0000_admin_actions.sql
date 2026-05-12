-- Phase 0: admin_actions audit log
-- Apply manually in Railway Postgres console.

CREATE TABLE IF NOT EXISTS admin_actions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email_hash TEXT        NOT NULL,
  action           TEXT        NOT NULL,
  target_type      TEXT,
  target_id        TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_actions_created_at_idx ON admin_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_action_idx     ON admin_actions (action);
