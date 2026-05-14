-- Phase 12a: user_dockets join table
-- Links users to tracked dockets via the existing dockets entity table.
-- Jurisdiction is encoded in dockets.source_id (FK → sources), not a column here.
-- Phase 12a exposes PUCT only; services populates dockets rows for ERCOT in 12b.

CREATE TABLE IF NOT EXISTS user_dockets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  docket_id  UUID        NOT NULL REFERENCES dockets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, docket_id)
);

CREATE INDEX IF NOT EXISTS user_dockets_user_id_idx   ON user_dockets (user_id);
CREATE INDEX IF NOT EXISTS user_dockets_docket_id_idx ON user_dockets (docket_id);
