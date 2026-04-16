import { describe, expect, it } from "vitest";
import { computeEcr } from "../scorers";

describe("computeEcr", () => {
  it("returns 0-1 score", () => {
    const result = computeEcr({
      hookScore: 8,
      timeToFirstVisualChange: 0.5,
      stopPower: 7,
      dominantFaceRatio: 0.6,
      hookColloquiality: 7,
    });
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
    expect(result.rationale).toMatch(/hook/i);
  });

  it("high-quality inputs → ECR > 0.6", () => {
    const { value } = computeEcr({
      hookScore: 9,
      timeToFirstVisualChange: 0.3,
      stopPower: 9,
      dominantFaceRatio: 0.7,
      hookColloquiality: 8,
    });
    expect(value).toBeGreaterThan(0.6);
  });

  it("poor-quality inputs → ECR < 0.4", () => {
    const { value } = computeEcr({
      hookScore: 2,
      timeToFirstVisualChange: 3.5,
      stopPower: 3,
      dominantFaceRatio: 0.1,
      hookColloquiality: 2,
    });
    expect(value).toBeLessThan(0.4);
  });

  it("clamps to [0, 1]", () => {
    const r1 = computeEcr({
      hookScore: 15,
      timeToFirstVisualChange: -1,
      stopPower: 20,
      dominantFaceRatio: 2,
      hookColloquiality: 15,
    });
    expect(r1.value).toBeLessThanOrEqual(1);
    const r2 = computeEcr({
      hookScore: -5,
      timeToFirstVisualChange: 10,
      stopPower: -5,
      dominantFaceRatio: -1,
      hookColloquiality: -5,
    });
    expect(r2.value).toBeGreaterThanOrEqual(0);
  });
});

import { computeNawp } from "../scorers";

describe("computeNawp", () => {
  it("short video with early payoff → NAWP > 0.6", () => {
    const { value } = computeNawp({
      durationSec: 12,
      pacingScore: 8,
      payoffIsEarly: true,
      emotionalFlowMatchScore: 8,
    });
    expect(value).toBeGreaterThan(0.6);
  });

  it("long video with late payoff → NAWP < 0.5", () => {
    const { value } = computeNawp({
      durationSec: 55,
      pacingScore: 5,
      payoffIsEarly: false,
      emotionalFlowMatchScore: 4,
    });
    expect(value).toBeLessThan(0.5);
  });

  it("duration-bucketed baselines distinct", () => {
    const short = computeNawp({
      durationSec: 10,
      pacingScore: 6,
      payoffIsEarly: true,
      emotionalFlowMatchScore: 6,
    });
    const long = computeNawp({
      durationSec: 50,
      pacingScore: 6,
      payoffIsEarly: true,
      emotionalFlowMatchScore: 6,
    });
    expect(short.value).not.toBe(long.value);
  });
});

import { matchEmotionalBigram } from "../scorers";

describe("matchEmotionalBigram", () => {
  it("problem → hope → resolution scores high", () => {
    const r = matchEmotionalBigram([
      { primary: "frustration" },
      { primary: "problem" },
      { primary: "hope" },
      { primary: "resolution" },
    ]);
    expect(r.value).toBeGreaterThan(6);
    expect(r.sequence).toEqual([
      "frustration",
      "problem",
      "hope",
      "resolution",
    ]);
  });

  it("humor → sadness → hope scores high", () => {
    const r = matchEmotionalBigram([
      { primary: "humor" },
      { primary: "humor" },
      { primary: "sadness" },
      { primary: "hope" },
    ]);
    expect(r.value).toBeGreaterThan(6);
  });

  it("flat arc scores low", () => {
    const r = matchEmotionalBigram([
      { primary: "neutral" },
      { primary: "neutral" },
      { primary: "neutral" },
    ]);
    expect(r.value).toBeLessThan(4);
  });

  it("empty input → 0", () => {
    expect(matchEmotionalBigram([]).value).toBe(0);
  });

  it("deduplicates adjacent-identical emotions in sequence", () => {
    const r = matchEmotionalBigram([
      { primary: "problem" },
      { primary: "problem" },
      { primary: "hope" },
    ]);
    expect(r.sequence).toEqual(["problem", "hope"]);
  });
});

import { computeComplexityAdjustedRhythm } from "../scorers";

describe("computeComplexityAdjustedRhythm", () => {
  it("high cuts / high complexity → moderate rhythm", () => {
    const r = computeComplexityAdjustedRhythm({
      cutsPerMinute: 30,
      sceneComplexity: [{ start: 0, complexity: 8 }, { start: 5, complexity: 9 }],
    });
    expect(r.value).toBeCloseTo(30 / 8.5, 1);
  });

  it("empty complexity → fallback baseline of 5", () => {
    const r = computeComplexityAdjustedRhythm({
      cutsPerMinute: 20,
      sceneComplexity: [],
    });
    expect(r.value).toBeCloseTo(20 / 5, 1);
  });

  it("value clamped to [0, 100]", () => {
    const r = computeComplexityAdjustedRhythm({
      cutsPerMinute: 1000,
      sceneComplexity: [{ start: 0, complexity: 0.1 }],
    });
    expect(r.value).toBeLessThanOrEqual(100);
  });
});
