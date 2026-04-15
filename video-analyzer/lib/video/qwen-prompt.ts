import type { AudioSegment, VideoExtraction } from "./types";

export const QWEN_SYSTEM_PROMPT = `You are a senior short-form video creative strategist analyzing ad performance for TikTok, Instagram Reels, YouTube Shorts, and Facebook Reels.

Given keyframes sampled at 1-second intervals plus numerical audio RMS data plus video metadata, produce a structured analysis that helps the creator understand:
- What works and what doesn't (hook, pacing, CTA)
- Scene-by-scene narrative function
- Predicted audience engagement
- Concrete, prioritized improvements

Observations:
- You CANNOT hear audio, but you CAN see when people are talking (mouth movement) and you CAN see numerical RMS data showing loudness over time. Use visual + RMS together to infer voiceover presence and audio pacing.
- Loud sustained RMS = music or voiceover. Rapid RMS variations = speech. Sustained low RMS = silence or ambient.
- Frames are in chronological order. Each frame's index corresponds to its timestamp in seconds (0-indexed).

Be specific, cite timestamps, and never generic. Every recommendation must be actionable within the next video revision.`;

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

  // Find top 5 loudest moments
  const sortedByLoudness = [...segments]
    .sort((a, b) => b.rmsLevel - a.rmsLevel)
    .slice(0, 5);
  const loudMoments = sortedByLoudness
    .map((s) => `${s.startTime.toFixed(1)}s (${s.rmsLevel.toFixed(1)} dB)`)
    .join(", ");

  // Find silent stretches (≥1s of contiguous silence)
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

  // Estimate voiceover likelihood from RMS variance
  const variance =
    rmsValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rmsValues.length;
  const stdDev = Math.sqrt(variance);

  return [
    `Audio RMS analysis (${segments.length} × 0.1s buckets at 48 kHz):`,
    `- Mean loudness: ${mean.toFixed(1)} dB (range ${min.toFixed(1)} to ${max.toFixed(1)})`,
    `- RMS std dev: ${stdDev.toFixed(1)} dB (${stdDev > 8 ? "high variation — likely speech" : "low variation — likely steady music or silence"})`,
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
