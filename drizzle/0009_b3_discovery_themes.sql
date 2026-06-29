-- B3 Discovery themes — web-owned tables (user-written).
-- The shared `themes` taxonomy and `discovery_matches` are services-owned
-- (sql/add_discovery_themes.sql in nodalpulse-services). These reference them
-- by stable key/accession text — no cross-repo FK.
-- Idempotent so it can be applied to the shared DB safely.

CREATE TABLE IF NOT EXISTS watched_themes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_key  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watched_themes_user_theme_unique UNIQUE (user_id, theme_key)
);
CREATE INDEX IF NOT EXISTS idx_watched_themes_user_id ON watched_themes (user_id);

CREATE TABLE IF NOT EXISTS discovery_dismissals (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accession  TEXT        NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discovery_dismissals_user_accession_unique UNIQUE (user_id, accession)
);
CREATE INDEX IF NOT EXISTS idx_discovery_dismissals_user_id ON discovery_dismissals (user_id);

CREATE TABLE IF NOT EXISTS theme_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL,
  note       TEXT,
  status     TEXT        NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_theme_requests_user_id ON theme_requests (user_id);
