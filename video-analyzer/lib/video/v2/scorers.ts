export type ScorerResult = { value: number; rationale: string };

export type EcrInputs = {
  hookScore: number; // 0-10
  timeToFirstVisualChange: number; // seconds
  stopPower: number; // 0-10
  dominantFaceRatio: number; // 0-1
  hookColloquiality: number; // 0-10
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Logistic probe: weighted sum → sigmoid.
 * Weights are hand-tuned from research priors:
 *   - stopPower and hookScore dominate (attention capture)
 *   - timeToFirstVisualChange inverted (faster = better)
 *   - dominantFaceRatio and colloquiality are secondary boosters
 */
export function computeEcr(i: EcrInputs): ScorerResult {
  const bias = -4;
  const z =
    bias +
    0.45 * i.hookScore +
    0.35 * i.stopPower +
    -0.6 * Math.min(i.timeToFirstVisualChange, 5) +
    1.5 * clamp01(i.dominantFaceRatio) +
    0.2 * i.hookColloquiality;
  const value = Number(clamp01(sigmoid(z)).toFixed(3));
  const rationale =
    `hook=${i.hookScore.toFixed(1)}, stop=${i.stopPower.toFixed(1)}, ` +
    `t1vc=${i.timeToFirstVisualChange.toFixed(2)}s, face=${i.dominantFaceRatio.toFixed(
      2
    )}, colloq=${i.hookColloquiality.toFixed(1)}`;
  return { value, rationale };
}

export type NawpInputs = {
  durationSec: number;
  pacingScore: number;
  payoffIsEarly: boolean;
  emotionalFlowMatchScore: number;
};

function durationBucketBaseline(seconds: number): number {
  if (seconds < 15) return 0.72;
  if (seconds < 30) return 0.58;
  if (seconds < 60) return 0.45;
  return 0.32;
}

export function computeNawp(i: NawpInputs): ScorerResult {
  const baseline = durationBucketBaseline(i.durationSec);
  const adj =
    0.08 * (i.pacingScore - 5) / 5 +
    (i.payoffIsEarly ? 0.06 : -0.06) +
    0.04 * (i.emotionalFlowMatchScore - 5) / 5;
  const value = Number(clamp01(baseline + adj).toFixed(3));
  const bucket =
    i.durationSec < 15
      ? "<15s"
      : i.durationSec < 30
        ? "15-30s"
        : i.durationSec < 60
          ? "30-60s"
          : "60s+";
  const rationale =
    `bucket=${bucket} base=${baseline}, ` +
    `pacing=${i.pacingScore.toFixed(1)}, payoffEarly=${i.payoffIsEarly}, ` +
    `flow=${i.emotionalFlowMatchScore.toFixed(1)}`;
  return { value, rationale };
}

export type EmotionalArcItem = { primary: string };

export type BigramResult = {
  value: number;
  sequence: string[];
  matchedPatterns: string[];
  rationale: string;
};

// Known high-performing patterns from emotional-flow research
// (Frontiers 2025 + narrative-transportation lit).
// Each pattern is a normalized sequence of emotion-families.
const PATTERNS: { name: string; seq: string[]; weight: number }[] = [
  { name: "problem-hope-resolution", seq: ["problem", "hope", "resolution"], weight: 9 },
  { name: "humor-sadness-hope", seq: ["humor", "sadness", "hope"], weight: 9 },
  { name: "curiosity-reveal-validation", seq: ["curiosity", "reveal", "validation"], weight: 8 },
  { name: "frustration-relief-joy", seq: ["frustration", "relief", "joy"], weight: 8 },
  { name: "problem-agitation-resolution", seq: ["problem", "agitation", "resolution"], weight: 7 },
];

// Fold near-synonyms to pattern vocabulary.
const SYNONYMS: Record<string, string> = {
  pain: "problem",
  struggle: "problem",
  discomfort: "problem",
  confusion: "curiosity",
  intrigue: "curiosity",
  satisfaction: "validation",
  joy: "joy",
  delight: "joy",
  laughter: "humor",
  amusement: "humor",
  sad: "sadness",
  grief: "sadness",
  melancholy: "sadness",
  optimism: "hope",
  inspiration: "hope",
  triumph: "resolution",
  success: "resolution",
  relief: "relief",
};

function normalizeEmotion(raw: string): string {
  const k = raw.toLowerCase().trim();
  return SYNONYMS[k] ?? k;
}

function dedupeAdjacent(arr: string[]): string[] {
  const out: string[] = [];
  for (const v of arr) {
    if (out[out.length - 1] !== v) out.push(v);
  }
  return out;
}

function containsSubsequence(hay: string[], needle: string[]): boolean {
  if (needle.length === 0) return true;
  let i = 0;
  for (const h of hay) {
    if (h === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

export function matchEmotionalBigram(
  arc: EmotionalArcItem[]
): BigramResult {
  if (arc.length === 0) {
    return { value: 0, sequence: [], matchedPatterns: [], rationale: "empty arc" };
  }
  const sequence = dedupeAdjacent(arc.map((a) => normalizeEmotion(a.primary)));
  const matched: string[] = [];
  let bestWeight = 0;
  for (const p of PATTERNS) {
    if (containsSubsequence(sequence, p.seq)) {
      matched.push(p.name);
      bestWeight = Math.max(bestWeight, p.weight);
    }
  }
  // If no pattern match, fall back to variety score (number of distinct emotions).
  const variety = new Set(sequence).size;
  const fallback = Math.min(variety * 1.2, 5);
  const value = Number(Math.max(bestWeight, fallback).toFixed(2));
  const rationale =
    matched.length > 0
      ? `matched: ${matched.join(", ")}`
      : `no high-performing pattern; variety=${variety}`;
  return { value, sequence, matchedPatterns: matched, rationale };
}

export type ComplexityRhythmInputs = {
  cutsPerMinute: number;
  sceneComplexity: { start: number; complexity: number }[];
};

export function computeComplexityAdjustedRhythm(
  i: ComplexityRhythmInputs
): ScorerResult {
  const complexities = i.sceneComplexity
    .map((s) => s.complexity)
    .filter((c) => Number.isFinite(c) && c > 0);
  const mean =
    complexities.length === 0
      ? 5
      : complexities.reduce((a, b) => a + b, 0) / complexities.length;
  const raw = i.cutsPerMinute / mean;
  const value = Number(Math.max(0, Math.min(100, raw)).toFixed(2));
  const rationale = `cuts/min=${i.cutsPerMinute.toFixed(1)} / meanComplexity=${mean.toFixed(2)}`;
  return { value, rationale };
}
