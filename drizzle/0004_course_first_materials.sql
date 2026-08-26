-- Backfill before enforcing NOT NULL: preserve all existing courses, lessons,
-- materials and embeddings. Materials with no outline get a draft course.
ALTER TABLE "courses" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "source_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "outline_version" integer DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "course_id" uuid;--> statement-breakpoint
UPDATE "courses" c SET "name" = coalesce(nullif(c.title, ''), m.original_filename, 'Untitled course'),
  "outline_version" = CASE WHEN c.status = 'ready' THEN 0 ELSE -1 END
FROM "materials" m WHERE m.id = c.material_id;
--> statement-breakpoint
UPDATE "materials" m SET "course_id" = c.id FROM "courses" c
WHERE c.material_id = m.id AND c.owner_id = m.owner_id;
--> statement-breakpoint
INSERT INTO "courses" ("material_id", "owner_id", "name")
SELECT m.id, m.owner_id, m.original_filename FROM "materials" m WHERE m.course_id IS NULL;
--> statement-breakpoint
UPDATE "materials" m SET "course_id" = c.id FROM "courses" c
WHERE c.material_id = m.id AND c.owner_id = m.owner_id AND m.course_id IS NULL;
--> statement-breakpoint
UPDATE "courses" SET status = 'failed', generation_token = NULL,
  generation_error = 'Course setup changed. Please generate the outline again.' WHERE status = 'generating';
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "course_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_material_id_materials_id_fk";--> statement-breakpoint
DROP INDEX "courses_material_unique";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "material_id";--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "materials_owner_course_idx" ON "materials" USING btree ("owner_id","course_id");--> statement-breakpoint
-- Revision updates share the course row lock used by outline publication.
-- Including every status write also covers a repeated indexing completion.
CREATE FUNCTION bump_course_source_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE courses SET source_version = source_version + 1, updated_at = now() WHERE id = OLD.course_id;
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE courses SET source_version = source_version + 1, updated_at = now() WHERE id = NEW.course_id;
  ELSE
    UPDATE courses SET source_version = source_version + 1, updated_at = now()
    WHERE id = NEW.course_id OR id = OLD.course_id;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER materials_course_source_version
AFTER INSERT OR DELETE OR UPDATE OF status, course_id ON materials
FOR EACH ROW EXECUTE FUNCTION bump_course_source_version();
