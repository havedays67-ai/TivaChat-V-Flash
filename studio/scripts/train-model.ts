import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { FEATURE_DIM, extractFeatures } from "../src/lib/engine/features";
import { INTENT_KEYS } from "../src/lib/engine/intents";
import { TEST_CASES } from "../src/lib/engine/tests";

const VERSION = "1.0.2";
const EPOCHS = 5;
const LEARNING_RATE = 0.22;
const EPSILON = 1e-8;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function softmaxScores(scores: Float64Array): { probs: Float64Array; loss: number; predicted: number } {
  let max = -Infinity;
  for (let i = 0; i < scores.length; i += 1) if (scores[i] > max) max = scores[i];
  const probs = new Float64Array(scores.length);
  let sum = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const value = Math.exp(scores[i] - max);
    probs[i] = value;
    sum += value;
  }
  let predicted = 0;
  for (let i = 0; i < scores.length; i += 1) {
    probs[i] /= sum;
    if (probs[i] > probs[predicted]) predicted = i;
  }
  return { probs, loss: 0, predicted };
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const classes = INTENT_KEYS;
  const classIndex = new Map(classes.map((key, index) => [key, index]));
  const dim = FEATURE_DIM;
  const params = dim * classes.length;

  const rows = await client.query<{ class_key: string; text: string; split: string }>(
    "select class_key, text, split from dataset_samples",
  );
  const train = rows.rows.filter((row) => row.split === "train" && classIndex.has(row.class_key));
  const test = rows.rows.filter((row) => row.split === "test" && classIndex.has(row.class_key));

  if (train.length < 1000) throw new Error("dataset is empty; run generate-dataset first");

  console.log(`training on ${train.length} samples, testing on ${test.length}, dim=${dim}, classes=${classes.length}, params=${params}`);

  const weights = new Float32Array(params);
  const accum = new Float32Array(params);
  const rng = mulberry32(424242);
  const started = Date.now();
  const indices = train.map((row) => classIndex.get(row.class_key) as number);

  for (let epoch = 0; epoch < EPOCHS; epoch += 1) {
    const order = train.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    let epochLoss = 0;
    for (const rowIndex of order) {
      const target = indices[rowIndex];
      const features = extractFeatures(train[rowIndex].text);
      const scores = new Float64Array(classes.length);
      for (let c = 0; c < classes.length; c += 1) {
        const offset = c * dim;
        let score = 0;
        for (const feature of features) score += weights[offset + feature];
        scores[c] = score;
      }
      const { probs } = softmaxScores(scores);
      epochLoss += -Math.log(Math.max(1e-12, probs[target]));

      const grad = new Float64Array(classes.length);
      for (let c = 0; c < classes.length; c += 1) grad[c] = probs[c] - (c === target ? 1 : 0);

      for (const feature of features) {
        for (let c = 0; c < classes.length; c += 1) {
          const gradient = grad[c];
          if (gradient === 0) continue;
          const index = c * dim + feature;
          accum[index] += gradient * gradient;
          weights[index] -= (LEARNING_RATE * gradient) / Math.sqrt(accum[index] + EPSILON);
        }
      }
    }
    console.log(`epoch ${epoch + 1}/${EPOCHS} loss=${(epochLoss / order.length).toFixed(4)} elapsed=${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  // ---------- evaluation ----------
  function infer(text: string): Float64Array {
    const features = extractFeatures(text);
    const scores = new Float64Array(classes.length);
    for (let c = 0; c < classes.length; c += 1) {
      const offset = c * dim;
      let score = 0;
      for (const feature of features) score += weights[offset + feature];
      scores[c] = score;
    }
    return softmaxScores(scores).probs;
  }

  const confusion = new Map<string, number>();
  const perClass = new Map<string, { support: number; tp: number; fp: number; fn: number }>();
  for (const key of classes) perClass.set(key, { support: 0, tp: 0, fp: 0, fn: 0 });
  let top1 = 0;
  let top3 = 0;

  for (const row of test) {
    const expected = classIndex.get(row.class_key) as number;
    const probs = infer(row.text);
    const ranking = [...probs.keys()].sort((a, b) => probs[b] - probs[a]);
    const predicted = ranking[0];
    if (predicted === expected) top1 += 1;
    if (ranking.slice(0, 3).includes(expected)) top3 += 1;

    const expectedKey = classes[expected];
    const predictedKey = classes[predicted];
    const expectedStats = perClass.get(expectedKey)!;
    expectedStats.support += 1;
    if (predicted === expected) expectedStats.tp += 1;
    else {
      expectedStats.fn += 1;
      perClass.get(predictedKey)!.fp += 1;
      const pairKey = `${expectedKey}|${predictedKey}`;
      confusion.set(pairKey, (confusion.get(pairKey) ?? 0) + 1);
    }
  }

  const perClassMetrics = classes.map((key) => {
    const stats = perClass.get(key)!;
    const precision = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
    const recall = stats.support > 0 ? stats.tp / stats.support : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return { key, support: stats.support, precision, recall, f1 };
  });
  const macroF1 = perClassMetrics.reduce((sum, item) => sum + item.f1, 0) / perClassMetrics.length;

  // Honest out-of-distribution check: the 51 hand-written acceptance prompts were never trained on.
  const acceptance = TEST_CASES.filter((testCase) => testCase.expected.intent).map((testCase) => {
    const probs = infer(testCase.prompt);
    let best = 0;
    for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[best]) best = i;
    return {
      key: testCase.key,
      prompt: testCase.prompt,
      expected: testCase.expected.intent as string,
      predicted: classes[best],
      probability: probs[best],
      correct: classes[best] === testCase.expected.intent,
    };
  });
  const acceptanceTop1 = acceptance.filter((item) => item.correct).length / Math.max(1, acceptance.length);
  const lowConfidence = acceptance.filter((item) => item.probability < 0.9).length;

  // ---------- quantize to int8 ----------
  const scales = new Array<number>(classes.length).fill(0);
  const biases = new Array<number>(classes.length).fill(0);
  const quantized = new Int8Array(params);
  for (let c = 0; c < classes.length; c += 1) {
    const offset = c * dim;
    let max = 0;
    for (let f = 0; f < dim; f += 1) {
      const value = Math.abs(weights[offset + f]);
      if (value > max) max = value;
    }
    const scale = max > 0 ? max / 127 : 1 / 127;
    scales[c] = scale;
    for (let f = 0; f < dim; f += 1) {
      quantized[offset + f] = Math.max(-127, Math.min(127, Math.round(weights[offset + f] / scale)));
    }
  }

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const binPath = path.join(dataDir, `tiva_model_${VERSION}.bin`);
  const metaPath = path.join(dataDir, `tiva_model_${VERSION}.meta.json`);
  const buffer = Buffer.from(quantized.buffer, quantized.byteOffset, quantized.byteLength);
  fs.writeFileSync(binPath, buffer);

  const artifactSha = createHash("sha256").update(buffer).digest("hex");
  const durationMs = Date.now() - started;
  const metrics = {
    features: ["word unigram", "word bigram", "char 4-gram", "length bucket"],
    perClass: perClassMetrics,
    confusion: [...confusion.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([pair, count]) => {
        const [expected, predicted] = pair.split("|");
        return { expected, predicted, count };
      }),
    init: "zeros (no pretraining, trained from scratch on this dataset)",
    optimizer: `AdaGrad, lr=${LEARNING_RATE}, epochs=${EPOCHS}, batch=single sample`,
    notes: [
      `آرتیفکت int8 با ${params.toLocaleString("en-US")} پارامتر و ${buffer.byteLength.toLocaleString("en-US")} بایت`,
      "ارزیابی روی ۱۵٪ دادهٔ کنارگذاشته (split قطعی بر پایهٔ هش متن)",
      "داده ترکیبی از الگوهای دستور است؛ دقت درون‌توزیعی خوش‌بینانه است",
      "این مدل LLM نیست: طبقه‌بند خطی روی ویژگی‌های n-gram است",
    ],
    acceptance: {
      total: acceptance.length,
      top1: acceptanceTop1,
      lowConfidence,
      misses: acceptance.filter((item) => !item.correct).map((item) => ({ prompt: item.prompt, expected: item.expected, predicted: item.predicted })),
    },
  };

  fs.writeFileSync(
    metaPath,
    JSON.stringify({
      version: VERSION,
      architecture: "hashed n-gram linear softmax (int8)",
      dim,
      params,
      classes,
      scales,
      biases,
      features: metrics.features,
      top1: top1 / Math.max(1, test.length),
      macroF1,
      sha256: artifactSha,
    }),
  );

  await client.query("delete from model_runs where version = $1", [VERSION]);
  const inserted = await client.query(
    `insert into model_runs
      (version, architecture, dim, class_count, params, train_rows, test_rows, epochs, learning_rate,
       top1, top3, macro_f1, loss, duration_ms, quantized, artifact_path, artifact_bytes, artifact_sha256, metrics)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,$15,$16,$17,$18)
     returning id`,
    [
      VERSION,
      "hashed n-gram linear softmax (int8)",
      dim,
      classes.length,
      params,
      train.length,
      test.length,
      EPOCHS,
      LEARNING_RATE,
      top1 / Math.max(1, test.length),
      top3 / Math.max(1, test.length),
      macroF1,
      0,
      durationMs,
      binPath,
      buffer.byteLength,
      artifactSha,
      JSON.stringify(metrics),
    ],
  );

  await client.end();
  console.log(
    JSON.stringify(
      {
        runId: inserted.rows[0].id,
        params,
        artifact: binPath,
        artifactBytes: buffer.byteLength,
        artifactSha,
        top1: (top1 / Math.max(1, test.length)).toFixed(4),
        top3: (top3 / Math.max(1, test.length)).toFixed(4),
        macroF1: macroF1.toFixed(4),
        acceptanceTop1: acceptanceTop1.toFixed(4),
        acceptanceMisses: acceptance.filter((item) => !item.correct).map((item) => `${item.prompt} → ${item.predicted}`),
        durationMs,
        classesWithRecallBelow08: perClassMetrics.filter((item) => item.recall < 0.8).map((item) => item.key),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
