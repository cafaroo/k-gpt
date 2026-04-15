import type { QwenAnalysis } from "../qwen-schema";
import type { BatchInsight, VideoJob } from "./types";

/**
 * Aggregate insights across a batch of videos.
 *
 * Two flavors:
 *  - Structural (always on): distribution of hook styles, CTA types, etc.
 *  - Performance-correlated (when CSV loaded): which creative pattern
 *    correlates with better hold/CTR/saves/etc.
 */

export function computeBatchInsights(videos: VideoJob[]): BatchInsight[] {
  const completed = videos.filter(
    (v): v is VideoJob & { qwen: QwenAnalysis } =>
      v.status === "done" && v.qwen !== null
  );
  if (completed.length === 0) {
    return [];
  }

  const insights: BatchInsight[] = [];

  insights.push(...hookStylePerformance(completed));
  insights.push(...ctaTimingInsight(completed));
  insights.push(...pacingCorrelation(completed));
  insights.push(...ruleComplianceInsight(completed));
  insights.push(...nichePlaybookInsight(completed));
  insights.push(...textOverlayInsight(completed));
  insights.push(...structuralDistribution(completed));

  return insights.sort((a, b) => b.confidence - a.confidence);
}

type CompletedVideo = VideoJob & { qwen: QwenAnalysis };

// ─── Helpers ────────────────────────────────────────────────────────────
function mean(nums: number[]): number {
  if (nums.length === 0) {
    return 0;
  }
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function videoMetric(v: CompletedVideo): number {
  // Prefer real CTR, else completion rate, else predicted composite.
  const perf = v.performance;
  if (perf?.clickThroughRate !== undefined) {
    return perf.clickThroughRate * 100; // % scale
  }
  if (perf?.completionRate !== undefined) {
    return perf.completionRate * 100;
  }
  const pm = v.qwen.predictedMetrics;
  return (
    (pm.holdTo3sScore +
      pm.saveLikelihood +
      pm.commentLikelihood +
      pm.shareLikelihood) /
    4
  );
}

function metricLabel(videos: CompletedVideo[]): string {
  if (videos.some((v) => v.performance?.clickThroughRate !== undefined)) {
    return "CTR %";
  }
  if (videos.some((v) => v.performance?.completionRate !== undefined)) {
    return "Completion %";
  }
  return "Predicted score";
}

function groupBy<T, K extends string>(
  items: T[],
  keyFn: (t: T) => K
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!map.has(k)) {
      map.set(k, []);
    }
    map.get(k)?.push(item);
  }
  return map;
}

// ─── Insight generators ────────────────────────────────────────────────

function hookStylePerformance(videos: CompletedVideo[]): BatchInsight[] {
  const groups = groupBy(videos, (v) => v.qwen.hook.primaryStyle);
  if (groups.size < 2) {
    return [];
  }

  const label = metricLabel(videos);
  const rows = [...groups.entries()].map(([style, vs]) => ({
    style,
    avg: mean(vs.map((v) => videoMetric(v))),
    n: vs.length,
    ids: vs.map((v) => v.id),
  }));
  rows.sort((a, b) => b.avg - a.avg);
  const best = rows[0];
  const worst = rows.at(-1);
  if (!(best && worst) || best.style === worst.style) {
    return [];
  }
  const delta = worst.avg === 0 ? best.avg : best.avg / worst.avg;
  return [
    {
      id: "hook-style-performance",
      kind: "hook-style-performance",
      title: "Hook style performance",
      finding: `"${best.style}" outperforms "${worst.style}" on ${label} (${best.avg.toFixed(1)} vs ${worst.avg.toFixed(1)}, ${delta.toFixed(1)}x)`,
      metric: label,
      delta,
      confidence: Math.min(0.3 + rows.length * 0.15, 0.95),
      videoIds: best.ids,
    },
  ];
}

function ctaTimingInsight(videos: CompletedVideo[]): BatchInsight[] {
  const groups = groupBy(videos, (v) => v.qwen.cta.timing);
  if (groups.size < 2) {
    return [];
  }
  const label = metricLabel(videos);
  const rows = [...groups.entries()].map(([timing, vs]) => ({
    timing,
    avg: mean(vs.map((v) => videoMetric(v))),
    n: vs.length,
    ids: vs.map((v) => v.id),
  }));
  rows.sort((a, b) => b.avg - a.avg);
  const best = rows[0];
  const worst = rows.at(-1);
  if (!(best && worst) || best.timing === worst.timing) {
    return [];
  }
  const delta = worst.avg === 0 ? best.avg : best.avg / worst.avg;
  return [
    {
      id: "cta-timing",
      kind: "cta-timing",
      title: "CTA timing",
      finding: `CTAs placed at "${best.timing}" beat "${worst.timing}" on ${label} (${delta.toFixed(1)}x)`,
      metric: label,
      delta,
      confidence: Math.min(0.25 + rows.length * 0.12, 0.9),
      videoIds: best.ids,
    },
  ];
}

function pacingCorrelation(videos: CompletedVideo[]): BatchInsight[] {
  const groups = groupBy(videos, (v) => v.qwen.pacing.rhythm);
  if (groups.size < 2) {
    return [];
  }
  const rows = [...groups.entries()].map(([rhythm, vs]) => ({
    rhythm,
    avg: mean(vs.map((v) => videoMetric(v))),
    n: vs.length,
    ids: vs.map((v) => v.id),
  }));
  rows.sort((a, b) => b.avg - a.avg);
  const best = rows[0];
  if (!best) {
    return [];
  }
  return [
    {
      id: "pacing-correlation",
      kind: "pacing-correlation",
      title: "Pacing rhythm",
      finding: `"${best.rhythm}" pacing leads with ${best.avg.toFixed(1)} avg ${metricLabel(videos)} across ${best.n} videos`,
      metric: metricLabel(videos),
      delta: best.avg,
      confidence: 0.55,
      videoIds: best.ids,
    },
  ];
}

function ruleComplianceInsight(videos: CompletedVideo[]): BatchInsight[] {
  const avgRulesMet = mean(
    videos.map((v) => v.qwen.ruleCompliance.filter((r) => r.met).length)
  );
  const totalRules = videos[0]?.qwen.ruleCompliance.length ?? 10;
  return [
    {
      id: "rule-compliance",
      kind: "rule-compliance",
      title: "Universal rule compliance",
      finding: `Avg ${avgRulesMet.toFixed(1)} / ${totalRules} universal rules met across the batch`,
      metric: "rules met",
      delta: avgRulesMet,
      confidence: 0.8,
      videoIds: videos.map((v) => v.id),
    },
  ];
}

function nichePlaybookInsight(videos: CompletedVideo[]): BatchInsight[] {
  const withPlaybook = videos.filter(
    (v) => v.qwen.niche.playbookCompliance.length > 0
  );
  if (withPlaybook.length === 0) {
    return [];
  }
  const gaps = withPlaybook.filter((v) =>
    v.qwen.niche.playbookCompliance.some((c) => !c.met)
  );
  if (gaps.length === 0) {
    return [];
  }
  return [
    {
      id: "niche-playbook",
      kind: "niche-playbook",
      title: "Niche playbook gaps",
      finding: `${gaps.length}/${withPlaybook.length} videos miss at least one item in their niche playbook`,
      metric: "compliance",
      delta: gaps.length / withPlaybook.length,
      confidence: 0.7,
      videoIds: gaps.map((v) => v.id),
    },
  ];
}

function textOverlayInsight(videos: CompletedVideo[]): BatchInsight[] {
  const groups = groupBy(videos, (v) => v.qwen.onScreenText.captionsVsOverlay);
  if (groups.size < 2) {
    return [];
  }
  const label = metricLabel(videos);
  const rows = [...groups.entries()].map(([kind, vs]) => ({
    kind,
    avg: mean(vs.map((v) => videoMetric(v))),
    n: vs.length,
    ids: vs.map((v) => v.id),
  }));
  rows.sort((a, b) => b.avg - a.avg);
  const best = rows[0];
  const worst = rows.at(-1);
  if (!(best && worst) || best.kind === worst.kind) {
    return [];
  }
  return [
    {
      id: "text-overlay",
      kind: "text-overlay",
      title: "On-screen text strategy",
      finding: `"${best.kind}" beats "${worst.kind}" on ${label} (${best.avg.toFixed(1)} vs ${worst.avg.toFixed(1)})`,
      metric: label,
      delta: worst.avg === 0 ? best.avg : best.avg / worst.avg,
      confidence: 0.6,
      videoIds: best.ids,
    },
  ];
}

function structuralDistribution(videos: CompletedVideo[]): BatchInsight[] {
  const formats = groupBy(videos, (v) => v.qwen.format.primary);
  const niches = groupBy(videos, (v) => v.qwen.niche.detected);

  const dominantFormat = [...formats.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )[0];
  const dominantNiche = [...niches.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )[0];

  const insights: BatchInsight[] = [];
  if (dominantFormat && dominantFormat[1].length >= 2) {
    insights.push({
      id: "struct-format",
      kind: "structural-distribution",
      title: "Format mix",
      finding: `${dominantFormat[1].length}/${videos.length} videos use "${dominantFormat[0]}" format`,
      metric: "count",
      delta: dominantFormat[1].length,
      confidence: 0.5,
      videoIds: dominantFormat[1].map((v) => v.id),
    });
  }
  if (dominantNiche && dominantNiche[1].length >= 2) {
    insights.push({
      id: "struct-niche",
      kind: "structural-distribution",
      title: "Niche mix",
      finding: `${dominantNiche[1].length}/${videos.length} videos detected as "${dominantNiche[0]}"`,
      metric: "count",
      delta: dominantNiche[1].length,
      confidence: 0.5,
      videoIds: dominantNiche[1].map((v) => v.id),
    });
  }
  return insights;
}

// ─── Distribution helpers for charts ────────────────────────────────────
export function scoreDistribution(videos: VideoJob[]): {
  bucket: string;
  count: number;
  ids: string[];
}[] {
  const buckets = [
    { min: 0, max: 30, label: "0–30" },
    { min: 30, max: 50, label: "30–50" },
    { min: 50, max: 70, label: "50–70" },
    { min: 70, max: 85, label: "70–85" },
    { min: 85, max: 101, label: "85+" },
  ];
  return buckets.map((b) => {
    const hits = videos.filter((v) => {
      const s = v.qwen?.overall.score ?? -1;
      return s >= b.min && s < b.max;
    });
    return { bucket: b.label, count: hits.length, ids: hits.map((v) => v.id) };
  });
}

export function topPerformers(videos: VideoJob[], n = 3): VideoJob[] {
  return [...videos]
    .filter((v) => v.qwen)
    .sort((a, b) => (b.qwen?.overall.score ?? 0) - (a.qwen?.overall.score ?? 0))
    .slice(0, n);
}

export function bottomPerformers(videos: VideoJob[], n = 3): VideoJob[] {
  return [...videos]
    .filter((v) => v.qwen)
    .sort((a, b) => (a.qwen?.overall.score ?? 0) - (b.qwen?.overall.score ?? 0))
    .slice(0, n);
}

export { mean };
