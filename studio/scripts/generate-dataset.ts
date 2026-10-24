import "dotenv/config";
import { Client } from "pg";
import { ensureSeed } from "../src/db/seed";
import { buildDataset } from "../src/lib/engine/dataset";

async function main() {
  await ensureSeed();
  const { samples, stats } = buildDataset();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("begin");
    await client.query("delete from dataset_samples");

    const chunkSize = 400;
    for (let i = 0; i < samples.length; i += chunkSize) {
      const chunk = samples.slice(i, i + chunkSize);
      const values: string[] = [];
      const params: unknown[] = [];
      chunk.forEach((sample, index) => {
        const base = index * 6;
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
        params.push(sample.classKey, sample.text, sample.normalized, sample.split, "generator-v1.0.2", sample.seed);
      });
      await client.query(
        `insert into dataset_samples (class_key, text, normalized, split, source, seed)
         values ${values.join(",")}
         on conflict (normalized) do nothing`,
        params,
      );
    }
    await client.query("commit");

    console.log(
      JSON.stringify(
        {
          total: stats.total,
          train: stats.train,
          test: stats.test,
          duplicatesSkipped: stats.duplicatesSkipped,
          classes: stats.perClass.length,
          min: Math.min(...stats.perClass.map((item) => item.count)),
          max: Math.max(...stats.perClass.map((item) => item.count)),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
