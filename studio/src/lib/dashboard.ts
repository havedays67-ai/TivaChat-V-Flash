import { cache } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeed } from "@/db/seed";
import {
  appRegistry,
  datasetSamples,
  intentClasses,
  modelRuns,
  patches,
  signingFacts,
  testResults,
  testRuns,
} from "@/db/schema";

export const getStaticBundle = cache(async () => {
  await ensureSeed();
  const [classes, apps, patchRows, facts] = await Promise.all([
    db.select().from(intentClasses).orderBy(asc(intentClasses.order)),
    db.select().from(appRegistry).orderBy(asc(appRegistry.category), asc(appRegistry.nameFa)),
    db.select().from(patches).orderBy(asc(patches.order)),
    db.select().from(signingFacts).orderBy(asc(signingFacts.id)),
  ]);
  return { classes, apps, patches: patchRows, facts };
});

export const getDatasetStats = cache(async () => {
  await ensureSeed();
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      train: sql<number>`count(*) filter (where ${datasetSamples.split} = 'train')::int`,
      test: sql<number>`count(*) filter (where ${datasetSamples.split} = 'test')::int`,
      uniqueNormalized: sql<number>`count(distinct ${datasetSamples.normalized})::int`,
    })
    .from(datasetSamples);

  const perClass = await db
    .select({ classKey: datasetSamples.classKey, count: sql<number>`count(*)::int` })
    .from(datasetSamples)
    .groupBy(datasetSamples.classKey);

  const counts = new Map(perClass.map((row) => [row.classKey, row.count]));
  const values = perClass.map((row) => row.count);
  return {
    total: totals?.total ?? 0,
    train: totals?.train ?? 0,
    test: totals?.test ?? 0,
    uniqueNormalized: totals?.uniqueNormalized ?? 0,
    perClass: counts,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    classCount: perClass.length,
  };
});

export const getLatestModel = cache(async () => {
  const [run] = await db.select().from(modelRuns).orderBy(desc(modelRuns.createdAt)).limit(1);
  return run ?? null;
});

export const getLatestTestRun = cache(async () => {
  const [run] = await db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(1);
  if (!run) return null;
  const results = await db
    .select()
    .from(testResults)
    .where(eq(testResults.runId, run.id))
    .orderBy(asc(testResults.id));
  return { run, results };
});

export async function getDatasetPage(options: { query?: string; classKey?: string; limit?: number }) {
  await ensureSeed();
  const limit = options.limit ?? 40;
  const filters = [];
  if (options.query) {
    filters.push(sql`(${datasetSamples.text} ilike ${`%${options.query}%`} or ${datasetSamples.classKey} ilike ${`%${options.query}%`})`);
  }
  if (options.classKey) filters.push(eq(datasetSamples.classKey, options.classKey));
  const where = filters.length ? sql.join(filters, sql` and `) : undefined;

  const rows = await db
    .select({
      id: datasetSamples.id,
      classKey: datasetSamples.classKey,
      text: datasetSamples.text,
      split: datasetSamples.split,
      seed: datasetSamples.seed,
    })
    .from(datasetSamples)
    .where(where)
    .orderBy(asc(datasetSamples.id))
    .limit(limit);

  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(datasetSamples)
    .where(where);

  return { rows, total: count?.total ?? 0 };
}

export type StaticBundle = Awaited<ReturnType<typeof getStaticBundle>>;
export type DatasetStats = Awaited<ReturnType<typeof getDatasetStats>>;
