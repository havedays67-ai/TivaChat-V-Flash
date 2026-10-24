import { integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";

/** 34 intent classes used by the engine, dataset and model. */
export const intentClasses = pgTable("intent_classes", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  labelFa: text("label_fa").notNull(),
  kind: text("kind").notNull(), // intent | meta | negative
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  risk: text("risk").notNull(), // safe | confirm | blocked
  honestLimit: text("honest_limit").notNull().default(""),
  sampleTarget: integer("sample_target").notNull().default(600),
  order: integer("order").notNull().default(0),
});

export const datasetSamples = pgTable(
  "dataset_samples",
  {
    id: serial("id").primaryKey(),
    classKey: text("class_key").notNull(),
    text: text("text").notNull(),
    normalized: text("normalized").notNull(),
    split: text("split").notNull(),
    source: text("source").notNull().default("generator"),
    seed: integer("seed").notNull().default(0),
  },
  (table) => [uniqueIndex("dataset_samples_normalized_idx").on(table.normalized)],
);

export const modelRuns = pgTable("model_runs", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  architecture: text("architecture").notNull(),
  dim: integer("dim").notNull(),
  classCount: integer("class_count").notNull(),
  params: integer("params").notNull(),
  trainRows: integer("train_rows").notNull(),
  testRows: integer("test_rows").notNull(),
  epochs: integer("epochs").notNull(),
  learningRate: real("learning_rate").notNull(),
  top1: real("top1").notNull(),
  top3: real("top3").notNull(),
  macroF1: real("macro_f1").notNull(),
  loss: real("loss").notNull(),
  durationMs: integer("duration_ms").notNull(),
  quantized: boolean("quantized").notNull().default(true),
  artifactPath: text("artifact_path").notNull(),
  artifactBytes: integer("artifact_bytes").notNull(),
  artifactSha256: text("artifact_sha256").notNull(),
  metrics: jsonb("metrics")
    .$type<{
      features: string[];
      perClass: { key: string; support: number; precision: number; recall: number; f1: number }[];
      confusion: { expected: string; predicted: string; count: number }[];
      init: string;
      optimizer: string;
      notes: string[];
      acceptance?: {
        total: number;
        top1: number;
        lowConfidence: number;
        misses: { prompt: string; expected: string; predicted: string }[];
      };
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appRegistry = pgTable("app_registry", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  nameFa: text("name_fa").notNull(),
  nameEn: text("name_en").notNull(),
  category: text("category").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  dualApp: boolean("dual_app").notNull().default(false),
  packageHint: text("package_hint"),
  packageSource: text("package_source").notNull().default("runtime"),
  note: text("note").notNull().default(""),
});

export const testCases = pgTable("test_cases", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  prompt: text("prompt").notNull(),
  group: text("group").notNull(),
  origin: text("origin").notNull(), // v1.0.1-regression | v1.0.2-requirement | learned
  expected: jsonb("expected").$type<Record<string, unknown>>().notNull(),
  why: text("why").notNull().default(""),
});

export const testRuns = pgTable("test_runs", {
  id: serial("id").primaryKey(),
  total: integer("total").notNull(),
  passed: integer("passed").notNull(),
  failed: integer("failed").notNull(),
  durationMs: integer("duration_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testResults = pgTable("test_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => testRuns.id, { onDelete: "cascade" }),
  caseKey: text("case_key").notNull(),
  prompt: text("prompt").notNull(),
  expected: text("expected").notNull(),
  actual: text("actual").notNull(),
  passed: boolean("passed").notNull(),
  detail: text("detail").notNull().default(""),
});

export const patches = pgTable("patches", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  target: text("target").notNull(),
  language: text("language").notNull(),
  kind: text("kind").notNull(), // source | manifest | gradle | doc
  requirement: text("requirement").notNull(),
  rationale: text("rationale").notNull(),
  content: text("content").notNull(),
  appliesTo: text("applies_to").notNull().default("1.0.2"),
  order: integer("order").notNull().default(0),
});

export const signingFacts = pgTable("signing_facts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  verified: boolean("verified").notNull().default(true),
  source: text("source").notNull(),
  note: text("note").notNull().default(""),
});

export type IntentClass = typeof intentClasses.$inferSelect;
export type DatasetSample = typeof datasetSamples.$inferSelect;
export type ModelRun = typeof modelRuns.$inferSelect;
export type AppEntry = typeof appRegistry.$inferSelect;
export type Patch = typeof patches.$inferSelect;
export type TestCaseRow = typeof testCases.$inferSelect;
export type TestRun = typeof testRuns.$inferSelect;
export type TestResult = typeof testResults.$inferSelect;
