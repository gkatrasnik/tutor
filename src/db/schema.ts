import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const materialSourceType = pgEnum("material_source_type", ["pdf", "text"]);
export const materialStatus = pgEnum("material_status", [
  "uploaded",
  "processing",
  "ready",
  "failed",
]);

export const courseStatus = pgEnum("course_status", ["pending", "generating", "ready", "failed"]);

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "restrict" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sourceType: materialSourceType("source_type").notNull(),
    originalFilename: text("original_filename").notNull(),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    extractedTextBlobUrl: text("extracted_text_blob_url"),
    extractedTextBlobPathname: text("extracted_text_blob_pathname"),
    byteSize: integer("byte_size").notNull(),
    characterCount: integer("character_count"),
    pageCount: integer("page_count"),
    status: materialStatus("status").default("uploaded").notNull(),
    processingError: text("processing_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("materials_owner_created_idx").on(table.ownerId, table.createdAt),
    index("materials_owner_course_idx").on(table.ownerId, table.courseId),
  ],
);

export const materialChunks = pgTable(
  "material_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    pageNumber: integer("page_number"),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("material_chunks_material_ordinal_unique").on(table.materialId, table.ordinal),
    index("material_chunks_owner_material_idx").on(table.ownerId, table.materialId),
    index("material_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status: courseStatus("status").default("pending").notNull(),
  title: text("title"),
  summary: text("summary"),
  lessonCount: integer("lesson_count").default(0).notNull(),
  sourceVersion: integer("source_version").default(0).notNull(),
  outlineVersion: integer("outline_version").default(-1).notNull(),
  generationError: text("generation_error"),
  generationToken: uuid("generation_token"),
  generationStartedAt: timestamp("generation_started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("courses_owner_created_idx").on(table.ownerId, table.createdAt),
]);

export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  concepts: jsonb("concepts").$type<string[]>().notNull(),
  retrievalQuery: text("retrieval_query").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("lessons_course_ordinal_unique").on(table.courseId, table.ordinal),
  index("lessons_owner_course_idx").on(table.ownerId, table.courseId),
]);

export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type MaterialChunk = typeof materialChunks.$inferSelect;
