CREATE TYPE "public"."course_status" AS ENUM('pending', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"status" "course_status" DEFAULT 'pending' NOT NULL,
	"title" text,
	"summary" text,
	"lesson_count" integer DEFAULT 0 NOT NULL,
	"generation_error" text,
	"generation_token" uuid,
	"generation_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"title" text NOT NULL,
	"objective" text NOT NULL,
	"concepts" jsonb NOT NULL,
	"retrieval_query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "courses_material_unique" ON "courses" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "courses_owner_created_idx" ON "courses" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_course_ordinal_unique" ON "lessons" USING btree ("course_id","ordinal");--> statement-breakpoint
CREATE INDEX "lessons_owner_course_idx" ON "lessons" USING btree ("owner_id","course_id");