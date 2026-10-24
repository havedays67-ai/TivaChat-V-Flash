import { normalizeWithFinglish, tokens } from "./text";

/**
 * Feature space shared by the trainer (Node script) and the runtime.
 * 294,912 buckets x 34 classes = 10,027,008 learned parameters.
 */
export const FEATURE_DIM = 294912;
export const FEATURE_SPEC = ["word unigram", "word bigram", "char 4-gram", "length bucket", "class-free bias-free"];

export function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 13;
  return hash >>> 0;
}

/** Sparse feature indices (values are always 1.0). */
export function extractFeatures(text: string): number[] {
  const normalized = normalizeWithFinglish(text);
  const words = tokens(text);
  const indices = new Set<number>();

  indices.add(hash32(`bias:${Math.min(words.length, 12)}`) % FEATURE_DIM);

  for (const word of words) {
    if (word.length >= 2) indices.add(hash32(`u:${word}`) % FEATURE_DIM);
    for (let i = 0; i + 4 <= word.length; i += 1) {
      indices.add(hash32(`c:${word.slice(i, i + 4)}`) % FEATURE_DIM);
    }
  }
  for (let i = 0; i + 1 < words.length; i += 1) {
    indices.add(hash32(`b:${words[i]}_${words[i + 1]}`) % FEATURE_DIM);
  }
  if (normalized.length > 0) {
    indices.add(hash32(`len:${Math.min(48, Math.floor(normalized.length / 6))}`) % FEATURE_DIM);
  }
  return [...indices];
}
