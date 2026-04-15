import type { ExtractedFrame, MotionSegment, SceneChange } from "./types";

const GRAY_SIZE = 32;

export async function decodeToGray32(
  dataUrl: string
): Promise<Uint8ClampedArray> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = GRAY_SIZE;
  canvas.height = GRAY_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0, GRAY_SIZE, GRAY_SIZE);
  const { data } = ctx.getImageData(0, 0, GRAY_SIZE, GRAY_SIZE);
  const gray = new Uint8ClampedArray(GRAY_SIZE * GRAY_SIZE);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }
  return gray;
}

function meanAbsoluteDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
}

export function computeMotionAndScenes(frames: ExtractedFrame[]): {
  motion: MotionSegment[];
  scenes: SceneChange[];
} {
  const motion: MotionSegment[] = [];
  const rawScores: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1].gray32;
    const curr = frames[i].gray32;
    if (!(prev && curr)) {
      rawScores.push(0);
      continue;
    }
    // MAD ranges 0..255 — scale so 50 MAD ≈ 100 motion score
    const mad = meanAbsoluteDiff(prev, curr);
    const score = Math.min(100, (mad / 50) * 100);
    rawScores.push(score);
    motion.push({
      startTime: frames[i - 1].timestamp,
      endTime: frames[i].timestamp,
      motionScore: Math.round(score),
      interpretation: score > 50 ? "high" : score > 20 ? "medium" : "low",
    });
  }

  // Rolling-threshold scene detection: score > mean + 2*std, 1.5s debounce
  const scenes: SceneChange[] = [];
  if (rawScores.length > 2) {
    const mean = rawScores.reduce((s, v) => s + v, 0) / rawScores.length;
    const variance =
      rawScores.reduce((s, v) => s + (v - mean) ** 2, 0) / rawScores.length;
    const std = Math.sqrt(variance);
    const threshold = Math.max(15, mean + 2 * std);
    let lastSceneTime = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < rawScores.length; i++) {
      const score = rawScores[i];
      const ts = frames[i + 1].timestamp;
      if (score > threshold && ts - lastSceneTime >= 1.5) {
        scenes.push({
          timestamp: ts,
          score: Math.min(1, score / 100),
        });
        lastSceneTime = ts;
      }
    }
  }

  return { motion, scenes };
}
