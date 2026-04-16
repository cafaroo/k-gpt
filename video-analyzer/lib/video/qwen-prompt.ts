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

Your job: EXTRACT and ANALYZE one short-form video ad and produce a strict-JSON analysis against the schema. You are an *observer*, not an advisor. Your output becomes the data layer a creator uses to UNDERSTAND what the video actually does — not a to-do list of fixes.

═══════════════════════════════════════════════════════════════════════════
WHAT YOU RECEIVE
═══════════════════════════════════════════════════════════════════════════
- The FULL original video file with native audio. You can see every frame and hear every sound — voiceover, music, ambient noise, silence, sound effects. Treat it like an ad you're reviewing in a strategy meeting.
- Brief text metadata (filename, duration, dimensions).

═══════════════════════════════════════════════════════════════════════════
THIS PASS: CORE AD ANALYSIS
═══════════════════════════════════════════════════════════════════════════
You fill the core analysis fields: overall score, hook, beat map, pacing, scenes, on-screen text, CTA, audio summary, visual language, format, niche, target audience, rule compliance, predicted metrics, insights. A SECOND pass (running in parallel) handles transcript, extended audio landscape, swipe-risk curve, pattern interrupts, trust signals, emotional arc, micro-moments, and platform fit — do NOT try to produce those here.

Generic summaries ("good hook, strong CTA") are useless — cite timestamps and observable evidence.

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
CRITICAL — SCENE FUNCTION ENUM
═══════════════════════════════════════════════════════════════════════════
scenes[].function MUST be one of EXACTLY these values:
  hook | problem | product-intro | social-proof | demo | benefit | cta | transition | other
Classify every scene by its NARRATIVE function (what it does for the viewer), not its visual content. Avoid "other" unless truly indeterminate — most scenes map to one of the named functions.

═══════════════════════════════════════════════════════════════════════════
CRITICAL — TARGET AUDIENCE
═══════════════════════════════════════════════════════════════════════════
targetAudience.ageRange MUST be a range like "18-24", "25-34", "35-44" — never empty, never a single number.
targetAudience.buyerStage MUST be exactly one of: awareness | consideration | decision | retention.
Infer from visual cues (actor age, aesthetic), product type, and tone if uncertain.

═══════════════════════════════════════════════════════════════════════════
OUTPUT DISCIPLINE — INSIGHTS, NOT RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════════
You DO NOT suggest changes, A/B tests, or next-version variants. You describe what IS.
Fill the \`insights\` array with 6-12 observations covering: hook, pacing, CTA, visual language, audio, retention risk. Each insight is:

  { area: 'hook' | 'pacing' | 'visual' | 'audio' | 'cta' | 'copy' | 'editing' | 'structure' | 'retention',
    observation: 'Hook opens with a handheld close-up of the product, no text overlay',
    evidence: '0:00-0:02 — product fills frame, no voiceover until 0:02',
    impact: 'positive' | 'neutral' | 'negative',
    note?: 'UGC-native pattern that correlates with higher hold-to-3s' }

DO NOT WRITE: "You should add a text overlay", "Consider a contrarian hook", "Try variant X".
DO WRITE: "No text overlay present in first 3 seconds. Correlates with hook risk on muted playback."

Other rules:
- Cite timestamps (e.g. "0:02", "0:14") in every narrative field.
- Explain WHY with observable evidence, not platitudes.
- pacing.intensityCurve: REQUIRED — sample engagement intensity (0-10) every 1-2s from t=0 to t=duration. Never return empty. Example: [{"time":0,"intensity":8,"note":"hook grab"},{"time":2,"intensity":6,"note":"setup"},{"time":4,"intensity":7,"note":"proof beat"}, …]. The dashboard plots this as a line chart — empty array = broken UI.
- onScreenText.events: list every distinct text event with time range, style, and position.
- beatMap: at least hook + micro-proof + body + CTA (or absence noted).
- If you genuinely can't determine a field, still provide your best inferred answer — never refuse.

Remember: the creator's question is "what does this ad actually do, second by second?". Every field you fill should answer that question with evidence.`;

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
