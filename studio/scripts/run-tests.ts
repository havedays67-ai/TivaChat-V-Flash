import "dotenv/config";
import { Client } from "pg";
import { runSuite } from "../src/lib/engine/tests";

async function main() {
  const suite = runSuite();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const run = await client.query<{ id: number }>(
      "insert into test_runs (total, passed, failed, duration_ms) values ($1,$2,$3,$4) returning id",
      [suite.total, suite.passed, suite.failed, suite.durationMs],
    );
    const runId = run.rows[0].id;

    for (const outcome of suite.outcomes) {
      await client.query(
        `insert into test_results (run_id, case_key, prompt, expected, actual, passed, detail)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [runId, outcome.key, outcome.prompt, outcome.expected, outcome.actual, outcome.passed, outcome.detail],
      );
    }

    // keep the last 25 runs, drop older ones
    await client.query(
      `delete from test_runs where id not in (select id from test_runs order by created_at desc limit 25)`,
    );

    console.log(JSON.stringify({ runId, total: suite.total, passed: suite.passed, failed: suite.failed, durationMs: suite.durationMs }));
    for (const outcome of suite.outcomes.filter((item) => !item.passed)) {
      console.log(`FAIL ${outcome.key} | ${outcome.prompt} | ${outcome.detail}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
