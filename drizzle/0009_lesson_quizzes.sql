DROP INDEX "lesson_assessments_snapshot_unique";--> statement-breakpoint
ALTER TABLE "lesson_assessments" ADD COLUMN "quiz" jsonb;--> statement-breakpoint
ALTER TABLE "lesson_assessments" ADD COLUMN "answers" jsonb;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD COLUMN "lesson_plan" jsonb;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD COLUMN "completed_chunks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_assessments_snapshot_unique" ON "lesson_assessments" USING btree ("session_id","through_ordinal") WHERE "lesson_assessments"."status" = 'complete' and "lesson_assessments"."quiz" is null;