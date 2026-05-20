CREATE TABLE IF NOT EXISTS team_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email   text NOT NULL,
  invitee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  role            text NOT NULL DEFAULT 'member',
  status          text NOT NULL DEFAULT 'pending',
  invited_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  UNIQUE (owner_id, invitee_email)
);

CREATE INDEX IF NOT EXISTS idx_team_memberships_owner
  ON team_memberships (owner_id);

CREATE INDEX IF NOT EXISTS idx_team_memberships_invitee_email
  ON team_memberships (invitee_email);
