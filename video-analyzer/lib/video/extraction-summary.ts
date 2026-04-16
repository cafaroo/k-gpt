import type { AudioSegment, MotionSegment, SceneChange } from "./types";

/**
 * Pre-compute the text summaries Qwen needs, client-side, so we avoid
 * POSTing raw audioSegments/motionSegments arrays that can be hundreds of KB
 * for long videos. The server reuses these strings directly.
 */

export type ExtractionSummary = {
  audioText: string;
  motionText: string;
};

export function summarizeExtraction(params: {
  audioSegments: AudioSegment[];
  motionSegments: MotionSegment[];
  sceneChanges: SceneChange[];
  duration: number;
}): ExtractionSummary {
  return {
    audioText: summarizeAudio(params.audioSegments),
    motionText: summarizeMotion(
      params.motionSegments,
      params.sceneChanges,
      params.duration
    ),
  };
}

function summarizeAudio(segments: AudioSegment[]): string {
  if (segments.length === 0) {
    return "Audio: no data available.";
  }
  const silentCount = segments.filter((s) => s.isSilent).length;
  const silentPct = Math.round((silentCount / segments.length) * 100);
  const rms = segments.map((s) => s.rmsLevel);
  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  const max = Math.max(...rms);
  const min = Math.min(...rms);

  const loudest = [...segments]
    .sort((a, b) => b.rmsLevel - a.rmsLevel)
    .slice(0, 5)
    .map((s) => `${s.startTime.toFixed(1)}s (${s.rmsLevel.toFixed(1)} dB)`)
    .join(", ");

  const silentStretches: { start: number; end: number }[] = [];
  let stretchStart: number | null = null;
  for (const seg of segments) {
    if (seg.isSilent) {
      if (stretchStart === null) {
        stretchStart = seg.startTime;
      }
    } else if (stretchStart !== null) {
      const dur = seg.startTime - stretchStart;
      if (dur >= 1) {
        silentStretches.push({ start: stretchStart, end: seg.startTime });
      }
      stretchStart = null;
    }
  }

  const variance = rms.reduce((s, v) => s + (v - mean) ** 2, 0) / rms.length;
  const std = Math.sqrt(variance);

  return [
    `Audio RMS analysis (${segments.length} buckets):`,
    `- Mean: ${mean.toFixed(1)} dB (range ${min.toFixed(1)} to ${max.toFixed(1)})`,
    `- Std dev: ${std.toFixed(1)} dB (${std > 8 ? "high variation — likely speech/VO" : "low variation — likely steady music or silence"})`,
    `- Silent buckets: ${silentCount}/${segments.length} (${silentPct}%)`,
    `- Silent stretches ≥1s: ${
      silentStretches.length > 0
        ? silentStretches
            .map((s) => `${s.start.toFixed(1)}–${s.end.toFixed(1)}s`)
            .join(", ")
        : "none"
    }`,
    `- Loudest: ${loudest}`,
  ].join("\n");
}

function summarizeMotion(
  motion: MotionSegment[],
  scenes: SceneChange[],
  _duration: number
): string {
  const highMotion = motion
    .filter((m) => m.interpretation === "high")
    .map((m) => `${m.startTime.toFixed(1)}–${m.endTime.toFixed(1)}s`)
    .join(", ");
  const avgMotion =
    motion.length > 0
      ? Math.round(
          motion.reduce((s, m) => s + m.motionScore, 0) / motion.length
        )
      : 0;

  return [
    "Motion + scene-change heuristics (32×32 grayscale MAD):",
    `- Scene changes at: ${
      scenes.length > 0
        ? scenes.map((s) => s.timestamp.toFixed(1)).join(", ")
        : "none"
    }`,
    `- Average motion: ${avgMotion}/100`,
    `- High-motion segments: ${highMotion || "none"}`,
  ].join("\n");
}
