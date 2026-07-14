-- 0012_oidc_oauth_tables.sql — better-auth mcp()/oidc-provider tables (WS-A connector)
-- Idempotent, hand-applied: node scripts/apply-sql.mjs drizzle/0012_oidc_oauth_tables.sql
-- FK nuance: oauth_access_tokens.client_id + oauth_consents.client_id reference
-- oauth_applications.client_id (the UNIQUE text column), NOT id.

CREATE TABLE IF NOT EXISTS oauth_applications (
  id             TEXT PRIMARY KEY,
  name           TEXT,
  icon           TEXT,
  metadata       TEXT,
  client_id      TEXT NOT NULL UNIQUE,
  client_secret  TEXT,
  redirect_urls  TEXT,
  type           TEXT,
  disabled       BOOLEAN DEFAULT FALSE,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_applications_user_id_idx ON oauth_applications (user_id);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id                        TEXT PRIMARY KEY,
  access_token              TEXT NOT NULL UNIQUE,
  refresh_token             TEXT UNIQUE,
  access_token_expires_at   TIMESTAMPTZ,
  refresh_token_expires_at  TIMESTAMPTZ,
  client_id                 TEXT REFERENCES oauth_applications(client_id) ON DELETE CASCADE,
  user_id                   UUID REFERENCES users(id) ON DELETE CASCADE,
  scopes                    TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_client_id_idx ON oauth_access_tokens (client_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_user_id_idx   ON oauth_access_tokens (user_id);

CREATE TABLE IF NOT EXISTS oauth_consents (
  id            TEXT PRIMARY KEY,
  client_id     TEXT REFERENCES oauth_applications(client_id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  scopes        TEXT,
  consent_given BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_consents_client_id_idx ON oauth_consents (client_id);
CREATE INDEX IF NOT EXISTS oauth_consents_user_id_idx   ON oauth_consents (user_id);
