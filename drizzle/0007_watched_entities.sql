-- Discovery v0 (#85): per-user entity watch list for FERC broad-sweep match.
-- Owner: web (writes). nodalpulse-services reads for entity-match in compose_brief.
-- Apply via: railway run psql $DATABASE_URL -f drizzle/0007_watched_entities.sql

CREATE TABLE IF NOT EXISTS watched_entities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text        NOT NULL,           -- canonical: "Hecate Energy"
  aliases    text[]      NOT NULL DEFAULT '{}',  -- ["Hecate Energy LLC", "Hecate Energy Panther Path LLC"]
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_watched_entities_user_id ON watched_entities (user_id);
