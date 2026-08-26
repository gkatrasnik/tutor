CREATE TYPE "public"."assessment_status" AS ENUM('pending', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "lesson_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"through_ordinal" integer NOT NULL,
	"message_ids" jsonb NOT NULL,
	"retrieved_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "assessment_status" DEFAULT 'pending' NOT NULL,
	"score" integer,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_step" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_assessments_score_check" CHECK ("lesson_assessments"."score" between 0 and 100),
	CONSTRAINT "lesson_assessments_result_check" CHECK ("lesson_assessments"."status" <> 'complete' or ("lesson_assessments"."score" is not null and "lesson_assessments"."next_step" is not null))
);
--> statement-breakpoint
ALTER TABLE "lesson_assessments" ADD CONSTRAINT "lesson_assessments_session_id_tutor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tutor_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_assessments" ADD CONSTRAINT "lesson_assessments_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_assessments_request_unique" ON "lesson_assessments" USING btree ("session_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_assessments_snapshot_unique" ON "lesson_assessments" USING btree ("session_id","through_ordinal") WHERE "lesson_assessments"."status" = 'complete';--> statement-breakpoint
CREATE INDEX "lesson_assessments_owner_session_idx" ON "lesson_assessments" USING btree ("owner_id","session_id","created_at");