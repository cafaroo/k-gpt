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
