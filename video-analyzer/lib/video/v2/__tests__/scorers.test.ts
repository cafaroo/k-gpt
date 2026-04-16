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
