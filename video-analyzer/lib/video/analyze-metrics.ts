/**
 * Lightweight quality metrics for a completed analysis run.
 *
 * Goal: after `ensureBaseShape()` + `normalizeScores()` + schema validation,
 * report how "rich" the hydrated analysis actually is so we can track quality
 * deploy-over-deploy. Designed to be cheap enough to run in production; emits
 * one compact console.log that Vercel Logs can capture.
 */

import type { ZodIssue } from "zod";

export type ZodIssueSummary = {
  path: string;
  code: string;
  message: string;
};

export type PassMetrics = {
  label: string;
  latencyMs: number;
  repaired: boolean;
  parseError: string | null;
  zodIssueCount: number;
  zodIssueSample: ZodIssueSummary[];
};

export type CompletenessReport = {
  score: number;
  checked: number;
  filled: number;
  emptyArrays: string[];
  totalItems: number;
};

export type AnalyzeMetrics = {
  runId: string;
  totalLatencyMs: number;
  completeness: CompletenessReport;
  passes: PassMetrics[];
  repairPassTriggered: boolean;
  retryCount: number;
};

/**
 * Paths we care about for aggregate data. Each is an array field where
 * `[]` means the dashboard card falls back to empty-state and the field is
 * useless for cross-run analysis.
 */
const TRACKED_ARRAY_PATHS: readonly string[] = [
  // Base pass
  "hook.elements",
  "hook.improvements",
  "hook.secondaryStyles",
  "beatMap",
  "pacing.deadSpots",
  "pacing.intensityCurve",
  "scenes",
  "onScreenText.events",
  "onScreenText.pricesShown",
  "visual.dominantColors",
  "visual.shotTypes",
  "cta.improvements",
  "niche.playbookCompliance",
  "targetAudience.interests",
  "ruleCompliance",
  "insights",
  // Extended pass
  "extended.transcript.segments",
  "extended.audioExtended.voiceoverTone",
  "extended.audioExtended.music.energyCurve",
  "extended.audioExtended.music.drops",
  "extended.audioExtended.ambientSounds",
  "extended.audioExtended.soundEffects",
  "extended.audioExtended.silenceMoments",
  "extended.hookDissection.firstThreeSeconds",
  "extended.hookDissection.firstSecond.attentionTriggers",
  "extended.swipeRiskCurve",
  "extended.patternInterrupts",
  "extended.trustSignals",
  "extended.emotionalArc",
  "extended.microMoments",
];

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  let cursor: unknown = obj;
  for (const key of path.split(".")) {
    if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
      cursor = (cursor as Record<string, unknown>)[key];
    } else {
      return;
    }
  }
  return cursor;
}

export function computeCompleteness(
  analysis: Record<string, unknown>
): CompletenessReport {
  const emptyArrays: string[] = [];
  let checked = 0;
  let filled = 0;
  let totalItems = 0;

  for (const path of TRACKED_ARRAY_PATHS) {
    const value = getByPath(analysis, path);
    if (!Array.isArray(value)) {
      continue;
    }
    checked++;
    if (value.length === 0) {
      emptyArrays.push(path);
    } else {
      filled++;
      totalItems += value.length;
    }
  }

  const score = checked === 0 ? 0 : filled / checked;
  return { score, checked, filled, emptyArrays, totalItems };
}

export function summarizeZodIssues(
  issues: readonly ZodIssue[] | undefined,
  max = 8
): { count: number; sample: ZodIssueSummary[] } {
  if (!issues || issues.length === 0) {
    return { count: 0, sample: [] };
  }
  const sample = issues.slice(0, max).map((i) => ({
    path: i.path.join("."),
    code: i.code,
    message: i.message,
  }));
  return { count: issues.length, sample };
}

/**
 * One-line summary to stdout. Vercel Logs indexes this and we can grep for
 * `[analyze] metrics` to see quality trends.
 */
export function logMetrics(metrics: AnalyzeMetrics): void {
  const compact = {
    runId: metrics.runId,
    totalMs: metrics.totalLatencyMs,
    completeness: Number(metrics.completeness.score.toFixed(2)),
    filledArrays: `${metrics.completeness.filled}/${metrics.completeness.checked}`,
    totalItems: metrics.completeness.totalItems,
    emptyArrays: metrics.completeness.emptyArrays,
    passes: metrics.passes.map((p) => ({
      label: p.label,
      ms: p.latencyMs,
      repaired: p.repaired,
      zodIssues: p.zodIssueCount,
    })),
    repairPassTriggered: metrics.repairPassTriggered,
    retryCount: metrics.retryCount,
  };
  console.log(`[analyze] metrics ${JSON.stringify(compact)}`);
}
