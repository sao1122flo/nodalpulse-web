-- #119: add source column to entitlements so webhook recompute can distinguish
-- tier rows (overwritten on every webhook) from addon rows (overwritten on
-- every webhook) from beta_grandfather rows (never touched by webhook).
-- Default 'tier' tags all existing rows correctly — they were all written by
-- applyTierEntitlements which maps to the tier origin.

ALTER TABLE "entitlements" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'tier';

CREATE INDEX IF NOT EXISTS "idx_entitlements_user_source"
  ON "entitlements" ("user_id", "source");
