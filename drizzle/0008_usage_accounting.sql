CREATE TYPE "public"."ai_feature" AS ENUM('embedding', 'outline', 'tutor', 'assessment');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_status" AS ENUM('pending', 'success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."quota_kind" AS ENUM('tutor', 'ingestion');--> statement-breakpoint
CREATE TYPE "public"."quota_state" AS ENUM('reserved', 'started', 'released');--> statement-breakpoint
CREATE TABLE "ai_quota_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"day" text NOT NULL,
	"kind" "quota_kind" NOT NULL,
	"state" "quota_state" DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_rate_limits" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"requests" timestamp with time zone[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"request_id" uuid NOT NULL,
	"feature" "ai_feature" NOT NULL,
	"model" text NOT NULL,
	"status" "ai_usage_status" DEFAULT 'pending' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"reasoning_tokens" integer,
	"total_tokens" integer,
	"latency_ms" integer,
	"time_to_first_token_ms" integer,
	"cost_usd" numeric(24, 18),
	"gateway_generation_id" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_cost_nonnegative" CHECK ("ai_usage_events"."cost_usd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tutor_daily_usage" ADD COLUMN "ingestions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_quota_reservations" ADD CONSTRAINT "ai_quota_reservations_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_rate_limits" ADD CONSTRAINT "ai_rate_limits_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_quota_owner_day_idx" ON "ai_quota_reservations" USING btree ("owner_id","day");--> statement-breakpoint
CREATE INDEX "ai_usage_owner_created_idx" ON "ai_usage_events" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_request_idx" ON "ai_usage_events" USING btree ("request_id");