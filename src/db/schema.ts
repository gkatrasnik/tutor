import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const materialSourceType = pgEnum("material_source_type", [
  "pdf",
  "text",
]);
export const materialStatus = pgEnum("material_status", [
  "uploaded",
  "processing",
  "ready",
  "failed",
]);

export const courseStatus = pgEnum("course_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    // Null means an older index of unknown provenance; never assume its model.
    embeddingModel: text("embedding_model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("material_chunks_material_ordinal_unique").on(
      table.materialId,
      table.ordinal,
    ),
    index("material_chunks_owner_material_idx").on(
      table.ownerId,
      table.materialId,
    ),
    index("material_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: courseStatus("status").default("pending").notNull(),
    title: text("title"),
    summary: text("summary"),
    lessonCount: integer("lesson_count").default(0).notNull(),
    sourceVersion: integer("source_version").default(0).notNull(),
    outlineVersion: integer("outline_version").default(-1).notNull(),
    generationError: text("generation_error"),
    generationToken: uuid("generation_token"),
    generationStartedAt: timestamp("generation_started_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("courses_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    concepts: jsonb("concepts").$type<string[]>().notNull(),
    retrievalQuery: text("retrieval_query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("lessons_course_ordinal_unique").on(
      table.courseId,
      table.ordinal,
    ),
    index("lessons_owner_course_idx").on(table.ownerId, table.courseId),
  ],
);

export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const messageStatus = pgEnum("message_status", [
  "pending",
  "complete",
  "failed",
]);

export const tutorSessions = pgTable(
  "tutor_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    // Preserve conversations when outline replacement deletes a lesson.
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    lessonTitle: text("lesson_title").notNull(),
    objective: text("objective").notNull(),
    retrievalQuery: text("retrieval_query").notNull(),
    sourceVersion: integer("source_version").notNull(),
    nextSequence: integer("next_sequence").default(0).notNull(),
    activeToken: uuid("active_token"),
    activeStartedAt: timestamp("active_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tutor_sessions_lesson_unique").on(table.lessonId),
    index("tutor_sessions_owner_course_idx").on(table.ownerId, table.courseId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => tutorSessions.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    role: messageRole("role").notNull(),
    status: messageStatus("status").notNull(),
    content: text("content").default("").notNull(),
    retrievedChunkIds: jsonb("retrieved_chunk_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("messages_session_ordinal_unique").on(
      table.sessionId,
      table.ordinal,
    ),
    uniqueIndex("messages_request_role_unique").on(
      table.sessionId,
      table.requestId,
      table.role,
    ),
    index("messages_owner_session_idx").on(table.ownerId, table.sessionId),
  ],
);

export const tutorDailyUsage = pgTable(
  "tutor_daily_usage",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    turns: integer("turns").default(0).notNull(),
    ingestions: integer("ingestions").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("tutor_daily_usage_owner_day_unique").on(
      table.ownerId,
      table.day,
    ),
  ],
);

export const aiFeature = pgEnum("ai_feature", [
  "embedding",
  "outline",
  "tutor",
  "assessment",
]);
export const aiUsageStatus = pgEnum("ai_usage_status", [
  "pending",
  "success",
  "failure",
]);
export const quotaKind = pgEnum("quota_kind", ["tutor", "ingestion"]);
export const quotaState = pgEnum("quota_state", [
  "reserved",
  "started",
  "released",
]);

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    requestId: uuid("request_id").notNull(),
    feature: aiFeature("feature").notNull(),
    model: text("model").notNull(),
    status: aiUsageStatus("status").default("pending").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedTokens: integer("cached_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    totalTokens: integer("total_tokens"),
    latencyMs: integer("latency_ms"),
    timeToFirstTokenMs: integer("time_to_first_token_ms"),
    costUsd: numeric("cost_usd", { precision: 24, scale: 18 }),
    gatewayGenerationId: text("gateway_generation_id"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ai_usage_owner_created_idx").on(table.ownerId, table.createdAt),
    index("ai_usage_request_idx").on(table.requestId),
    check("ai_usage_cost_nonnegative", sql`${table.costUsd} >= 0`),
  ],
);

export const aiQuotaReservations = pgTable(
  "ai_quota_reservations",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    kind: quotaKind("kind").notNull(),
    state: quotaState("state").default("reserved").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("ai_quota_owner_day_idx").on(table.ownerId, table.day)],
);

export const aiRateLimits = pgTable("ai_rate_limits", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  requests: timestamp("requests", { withTimezone: true }).array().notNull(),
});

export const assessmentStatus = pgEnum("assessment_status", [
  "pending",
  "complete",
  "failed",
]);

export const lessonAssessments = pgTable(
  "lesson_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => tutorSessions.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull(),
    // Last completed assistant ordinal included in this assessment's evidence.
    throughOrdinal: integer("through_ordinal").notNull(),
    messageIds: jsonb("message_ids").$type<string[]>().notNull(),
    retrievedChunkIds: jsonb("retrieved_chunk_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
    status: assessmentStatus("status").default("pending").notNull(),
    score: integer("score"),
    strengths: jsonb("strengths").$type<string[]>().default([]).notNull(),
    gaps: jsonb("gaps").$type<string[]>().default([]).notNull(),
    nextStep: text("next_step"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("lesson_assessments_request_unique").on(
      table.sessionId,
      table.requestId,
    ),
    uniqueIndex("lesson_assessments_snapshot_unique")
      .on(table.sessionId, table.throughOrdinal)
      .where(sql`${table.status} = 'complete'`),
    index("lesson_assessments_owner_session_idx").on(
      table.ownerId,
      table.sessionId,
      table.createdAt,
    ),
    check(
      "lesson_assessments_score_check",
      sql`${table.score} between 0 and 100`,
    ),
    check(
      "lesson_assessments_result_check",
      sql`${table.status} <> 'complete' or (${table.score} is not null and ${table.nextStep} is not null)`,
    ),
  ],
);

export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type MaterialChunk = typeof materialChunks.$inferSelect;
