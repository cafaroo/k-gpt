import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ─── /analyze/v2 POC ────────────────────────────────────────────────────

export const batch = pgTable("Batch", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Batch = InferSelectModel<typeof batch>;

export const video = pgTable("Video", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  batchId: uuid("batchId").references(() => batch.id),
  blobUrl: text("blobUrl").notNull(),
  filename: text("filename").notNull(),
  fileSizeBytes: integer("fileSizeBytes").notNull(),
  durationSec: numeric("durationSec", { precision: 10, scale: 2 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  aspectRatio: text("aspectRatio").notNull(),
  userTags: json("userTags").$type<string[]>().notNull().default([]),
  thumbnailUrl: text("thumbnailUrl"),
  uploadedAt: timestamp("uploadedAt").notNull().defaultNow(),
  // When set, the underlying blob was purged to free storage. Analyses
  // (hot fields + JSON) stay usable; only the video player goes offline.
  videoDeletedAt: timestamp("videoDeletedAt"),
});

export type Video = InferSelectModel<typeof video>;

export const analysis = pgTable("Analysis", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  videoId: uuid("videoId")
    .notNull()
    .references(() => video.id),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  schemaVersion: text("schemaVersion").notNull().default("2026.04-v2"),
  status: varchar("status", {
    enum: ["pending", "done", "error"],
  }).notNull(),
  analysisBlobUrl: text("analysisBlobUrl"),
  rawBaseBlobUrl: text("rawBaseBlobUrl"),
  rawExtendedBlobUrl: text("rawExtendedBlobUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  completedAt: timestamp("completedAt"),
  latencyMs: integer("latencyMs"),
  completenessScore: numeric("completenessScore", { precision: 4, scale: 3 }),
  zodIssueCount: integer("zodIssueCount"),
  errorMessage: text("errorMessage"),

  // Hot fields
  overallScore: integer("overallScore"),
  hookScore: numeric("hookScore", { precision: 4, scale: 2 }),
  hookDuration: numeric("hookDuration", { precision: 5, scale: 2 }),
  stopPower: numeric("stopPower", { precision: 4, scale: 2 }),
  hookColloquiality: numeric("hookColloquiality", { precision: 4, scale: 2 }),
  pacingScore: numeric("pacingScore", { precision: 4, scale: 2 }),
  cutsPerMinute: numeric("cutsPerMinute", { precision: 6, scale: 2 }),
  complexityAdjustedRhythm: numeric("complexityAdjustedRhythm", {
    precision: 6,
    scale: 2,
  }),
  voiceoverCadence: numeric("voiceoverCadence", { precision: 5, scale: 2 }),
  emotionalTransitionScore: numeric("emotionalTransitionScore", {
    precision: 4,
    scale: 2,
  }),
  colloquialityScore: numeric("colloquialityScore", { precision: 4, scale: 2 }),
  authenticityBand: varchar("authenticityBand", {
    enum: ["low", "moderate", "high"],
  }),
  brandHeritageSalience: varchar("brandHeritageSalience", {
    enum: ["absent", "moderate", "high"],
  }),
  ecr: numeric("ecr", { precision: 4, scale: 3 }),
  nawp: numeric("nawp", { precision: 4, scale: 3 }),
  ctaClarity: numeric("ctaClarity", { precision: 4, scale: 2 }),
  payoffIsEarly: boolean("payoffIsEarly"),
  niche: text("niche"),
  formatPrimary: text("formatPrimary"),
  platformBestFit: text("platformBestFit"),

  // Detail jsonb
  insights: jsonb("insights"),
  beatMap: jsonb("beatMap"),
  scenes: jsonb("scenes"),
  ruleCompliance: jsonb("ruleCompliance"),
  researchMeta: jsonb("researchMeta"),

  // Batch 4 hot fields
  peopleCountMax: integer("peopleCountMax"),
  eyeContactScore: numeric("eyeContactScore", { precision: 4, scale: 2 }),
  scriptAngle: text("scriptAngle"),
  primaryGender: text("primaryGender"),
  socioeconomic: text("socioeconomic"),

  // Batch 4 jsonb columns
  audienceProfile: jsonb("audienceProfile"),
  peopleAnalysis: jsonb("peopleAnalysis"),
  cutsMap: jsonb("cutsMap"),
  scriptMeta: jsonb("scriptMeta"),
  eyeContact: jsonb("eyeContact"),
});

export type Analysis = InferSelectModel<typeof analysis>;
