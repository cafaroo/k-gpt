import { NICHE_PLAYBOOKS, UNIVERSAL_RULES } from "./framework/rules";
import {
  BEAT_TYPES,
  CTA_TYPES,
  FORMATS,
  HOOK_STYLES,
  NICHES,
} from "./framework/taxonomy";
import type { AudioSegment, VideoExtraction } from "./types";

const rulesBlock = UNIVERSAL_RULES.map(
  (r) =>
    `- [${r.id}] ${r.title}\n    ${r.detail}\n    CHECK: ${r.checkInstruction}`
).join("\n");

const nicheBlock = NICHE_PLAYBOOKS.map(
  (p) =>
    `- ${p.niche}:\n${p.checks
      .map((c) => `    • [${c.id}] ${c.label} — ${c.instruction}`)
      .join("\n")}`
).join("\n");

export const QWEN_SYSTEM_PROMPT = `You are a senior short-form video creative strategist specializing in TikTok, Instagram Reels, YouTube Shorts, and Facebook Reels ad performance.

Your job: take keyframes (1 per second), audio RMS statistics, and motion/scene heuristics for one video and produce a strict-JSON analysis against the schema provided.

═══════════════════════════════════════════════════════════════════════════
WHAT YOU CAN AND CAN'T SEE
═══════════════════════════════════════════════════════════════════════════
- You RECEIVE: ordered keyframes (1 per second, chronological), plus numerical audio RMS statistics and scene/motion heuristics as text.
- You CANNOT hear audio directly. You CAN see mouths moving, and you receive RMS stats (mean, std-dev, silent stretches, peak moments). Infer voiceover presence from RMS std-dev (high variation ⇒ likely speech) plus visible mouth movement.
- Each frame's index corresponds to its timestamp in seconds (0-indexed).

═══════════════════════════════════════════════════════════════════════════
SCORING FRAMEWORK — UNIVERSAL RULES (score each one)
═══════════════════════════════════════════════════════════════════════════
These are patterns that correlated with better engagement across 10k+ TikTok/Reels/Shorts videos. Score EACH rule in the ruleCompliance array with a concrete timestamp as evidence.

${rulesBlock}

═══════════════════════════════════════════════════════════════════════════
NICHE PLAYBOOKS — check the detected niche's checklist too
═══════════════════════════════════════════════════════════════════════════
${nicheBlock}

═══════════════════════════════════════════════════════════════════════════
TAXONOMIES — use the exact enum values
═══════════════════════════════════════════════════════════════════════════
Hook styles: ${HOOK_STYLES.join(" | ")}
Beat types: ${BEAT_TYPES.join(" | ")}
CTA types: ${CTA_TYPES.join(" | ")}
Formats: ${FORMATS.join(" | ")}
Niches: ${NICHES.join(" | ")}

═══════════════════════════════════════════════════════════════════════════
OUTPUT DISCIPLINE
═══════════════════════════════════════════════════════════════════════════
- Be specific. Cite timestamps (e.g. "0:02", "0:14").
- Never output generic platitudes like "good hook, strong CTA" — explain WHY with observable evidence.
- Every recommendation must include a 'testVariant' field: a concrete, ready-to-shoot alternative hook line or structure idea the creator can ship in their next version.
- Fill the testPlan with 3 DIFFERENT hook styles as ready-to-shoot drafts, and 2 structure variants (e.g. early-result vs delayed-result). These are what the creator will A/B test next week.
- intensityCurve: sample roughly once per second so the dashboard can plot it.
- onScreenText.events: list every distinct text event you see with its time range, style, and position.
- beatMap: at least hook + micro-proof (or equivalent) + body + CTA (or absence noted).
- If you genuinely can't determine a field, still provide your best inferred answer — never refuse.

Remember: the creator will ship A/B variants based on your testPlan. Make them distinct, specific, and non-generic.`;

export function buildQwenUserMessage(extraction: VideoExtraction): {
  metadataText: string;
  audioText: string;
  motionText: string;
} {
  const { metadata, audioSegments, motionSegments, sceneChanges } = extraction;

  const metadataText = [
    "Video metadata:",
    `- filename: ${metadata.filename}`,
    `- duration: ${metadata.duration.toFixed(1)}s`,
    `- dimensions: ${metadata.width}×${metadata.height} (${metadata.aspectRatio})`,
    `- filesize: ${(metadata.fileSize / 1024 / 1024).toFixed(1)} MB`,
    `- bitrate: ${Math.round(metadata.bitrate / 1000)} kbps`,
    `- frames sampled: ${Math.max(2, Math.floor(metadata.duration))} (one per second)`,
  ].join("\n");

  const audioText = summarizeAudio(audioSegments);

  const motionText = [
    "Motion + scene-change heuristics (32×32 grayscale MAD):",
    `- Scene changes detected at (seconds): ${
      sceneChanges.length > 0
        ? sceneChanges.map((s) => s.timestamp.toFixed(1)).join(", ")
        : "none"
    }`,
    `- Average motion score: ${
      motionSegments.length > 0
        ? Math.round(
            motionSegments.reduce((s, m) => s + m.motionScore, 0) /
              motionSegments.length
          )
        : 0
    }/100`,
    `- High-motion segments: ${
      motionSegments
        .filter((m) => m.interpretation === "high")
        .map((m) => `${m.startTime.toFixed(1)}–${m.endTime.toFixed(1)}s`)
        .join(", ") || "none"
    }`,
  ].join("\n");

  return { metadataText, audioText, motionText };
}

function summarizeAudio(segments: AudioSegment[]): string {
  if (segments.length === 0) {
    return "Audio: no data available.";
  }

  const silentCount = segments.filter((s) => s.isSilent).length;
  const silentPct = Math.round((silentCount / segments.length) * 100);
  const rmsValues = segments.map((s) => s.rmsLevel);
  const mean = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
  const max = Math.max(...rmsValues);
  const min = Math.min(...rmsValues);

  const sortedByLoudness = [...segments]
    .sort((a, b) => b.rmsLevel - a.rmsLevel)
    .slice(0, 5);
  const loudMoments = sortedByLoudness
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
        silentStretches.push({
          start: stretchStart,
          end: seg.startTime,
        });
      }
      stretchStart = null;
    }
  }

  const variance =
    rmsValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rmsValues.length;
  const stdDev = Math.sqrt(variance);

  return [
    `Audio RMS analysis (${segments.length} × 0.1s buckets):`,
    `- Mean loudness: ${mean.toFixed(1)} dB (range ${min.toFixed(1)} to ${max.toFixed(1)})`,
    `- RMS std dev: ${stdDev.toFixed(1)} dB (${stdDev > 8 ? "high variation — likely speech/VO" : "low variation — likely steady music or silence"})`,
    `- Silent buckets (< -40 dB): ${silentCount}/${segments.length} (${silentPct}%)`,
    `- Notable silent stretches (≥1s): ${
      silentStretches.length > 0
        ? silentStretches
            .map((s) => `${s.start.toFixed(1)}–${s.end.toFixed(1)}s`)
            .join(", ")
        : "none"
    }`,
    `- Loudest moments: ${loudMoments}`,
  ].join("\n");
}
