-- Phase P1: add tier to subscriptions, value to entitlements
-- Applied via: railway run --service nodalpulse-web npx drizzle-kit migrate

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "tier" text;
--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN IF NOT EXISTS "value" jsonb NOT NULL DEFAULT '{}'::jsonb;
