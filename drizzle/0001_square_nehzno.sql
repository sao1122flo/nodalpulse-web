CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notify" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fired_at" timestamp with time zone,
	CONSTRAINT "saved_searches_user_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "onboarding_step" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_searches_user_created_idx" ON "saved_searches" USING btree ("user_id","created_at");