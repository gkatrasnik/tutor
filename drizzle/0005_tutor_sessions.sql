CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('pending', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"role" "message_role" NOT NULL,
	"status" "message_status" NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"retrieved_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_daily_usage" (
	"owner_id" text NOT NULL,
	"day" text NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"lesson_id" uuid,
	"lesson_title" text NOT NULL,
	"objective" text NOT NULL,
	"retrieval_query" text NOT NULL,
	"source_version" integer NOT NULL,
	"next_sequence" integer DEFAULT 0 NOT NULL,
	"active_token" uuid,
	"active_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_tutor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tutor_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_daily_usage" ADD CONSTRAINT "tutor_daily_usage_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_session_ordinal_unique" ON "messages" USING btree ("session_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_request_role_unique" ON "messages" USING btree ("session_id","request_id","role");--> statement-breakpoint
CREATE INDEX "messages_owner_session_idx" ON "messages" USING btree ("owner_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_daily_usage_owner_day_unique" ON "tutor_daily_usage" USING btree ("owner_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_sessions_lesson_unique" ON "tutor_sessions" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "tutor_sessions_owner_course_idx" ON "tutor_sessions" USING btree ("owner_id","course_id");