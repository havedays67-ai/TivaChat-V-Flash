import fs from "node:fs";
import path from "node:path";
import { extractFeatures } from "./features";

export type ModelMeta = {
  version: string;
  architecture: string;
  dim: number;
  params: number;
  classes: string[];
  scales: number[];
  biases: number[];
  features: string[];
  top1: number;
  macroF1: number;
  sha256: string;
};

export type Prediction = {
  classKey: string;
  probability: number;
};

type LoadedModel = {
  meta: ModelMeta;
  weights: Int8Array;
};

const CACHE_KEY = "__tivaModel1_0_2";

function cache(): { model: LoadedModel | null; error: string | null; key: string } {
  const globalStore = globalThis as typeof globalThis & {
    [CACHE_KEY]?: { model: LoadedModel | null; error: string | null; key: string };
  };
  if (!globalStore[CACHE_KEY]) {
    globalStore[CACHE_KEY] = { model: null, error: null, key: "" };
  }
  return globalStore[CACHE_KEY]!;
}

export function modelArtifactPaths(): { bin: string; meta: string } {
  const root = process.cwd();
  return {
    bin: path.join(root, "data", "tiva_model_1.0.2.bin"),
    meta: path.join(root, "data", "tiva_model_1.0.2.meta.json"),
  };
}

export function loadModel(): { model: LoadedModel | null; error: string | null } {
  const store = cache();
  const { bin, meta } = modelArtifactPaths();

  if (!fs.existsSync(bin) || !fs.existsSync(meta)) {
    return { model: null, error: "آرتیفکت مدل آموزش‌دیده پیدا نشد. اسکریپت train-model را اجرا کنید." };
  }

  const stat = fs.statSync(bin);
  const key = `${stat.mtimeMs}:${stat.size}`;
  if (store.model && store.key === key) return { model: store.model, error: null };

  try {
    const metaJson = JSON.parse(fs.readFileSync(meta, "utf8")) as ModelMeta;
    const buffer = fs.readFileSync(bin);
    const expected = metaJson.dim * metaJson.classes.length;
    if (buffer.byteLength !== expected) {
      return { model: null, error: `حجم آرتیفکت ${buffer.byteLength} با انتظار ${expected} نمی‌خواند.` };
    }
    const weights = new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    store.model = { meta: metaJson, weights: new Int8Array(weights) };
    store.key = key;
    store.error = null;
    return { model: store.model, error: null };
  } catch (error) {
    store.model = null;
    store.error = error instanceof Error ? error.message : "خطای ناشناخته در بارگذاری مدل";
    return { model: null, error: store.error };
  }
}

export function predict(text: string): { predictions: Prediction[]; params: number; error: string | null } {
  const { model, error } = loadModel();
  if (!model) return { predictions: [], params: 0, error };

  const { meta, weights } = model;
  const features = extractFeatures(text);
  const classes = meta.classes;
  const scores = new Array<number>(classes.length).fill(0);

  for (let c = 0; c < classes.length; c += 1) {
    const offset = c * meta.dim;
    const scale = meta.scales[c] ?? 0.01;
    let score = (meta.biases[c] ?? 0) * 4;
    for (const feature of features) score += weights[offset + feature] * scale;
    scores[c] = score;
  }

  const max = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  const probabilities = exps.map((value) => value / sum);

  const predictions = classes
    .map((classKey, index) => ({ classKey, probability: probabilities[index] }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);

  return { predictions, params: meta.params, error: null };
}
