import { desc, inArray, not } from "drizzle-orm";
import { db } from "@/db";
import { testResults, testRuns } from "@/db/schema";
import { runSuite } from "@/lib/engine/tests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const suite = runSuite();

  const [run] = await db
    .insert(testRuns)
    .values({ total: suite.total, passed: suite.passed, failed: suite.failed, durationMs: suite.durationMs })
    .returning({ id: testRuns.id, createdAt: testRuns.createdAt });

  await db.insert(testResults).values(
    suite.outcomes.map((outcome) => ({
      runId: run.id,
      caseKey: outcome.key,
      prompt: outcome.prompt,
      expected: outcome.expected,
      actual: outcome.actual,
      passed: outcome.passed,
      detail: outcome.detail,
    })),
  );

  const keep = await db.select({ id: testRuns.id }).from(testRuns).orderBy(desc(testRuns.createdAt)).limit(25);
  if (keep.length > 0) {
    await db.delete(testRuns).where(not(inArray(testRuns.id, keep.map((row) => row.id))));
  }

  return Response.json({
    ok: true,
    runId: run.id,
    total: suite.total,
    passed: suite.passed,
    failed: suite.failed,
    durationMs: suite.durationMs,
    failures: suite.outcomes.filter((outcome) => !outcome.passed).map((outcome) => ({
      key: outcome.key,
      prompt: outcome.prompt,
      detail: outcome.detail,
    })),
  });
}
