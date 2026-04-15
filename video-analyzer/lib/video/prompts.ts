import type { PerformanceData, VideoExtraction } from "./types";

export function buildVideoAnalysisPrompt(
  extraction: VideoExtraction,
  performance?: PerformanceData
): string {
  const { metadata, sceneChanges, audioSegments, motionSegments } = extraction;

  const loudest = audioSegments.length
    ? audioSegments.reduce((max, a) => (a.rmsLevel > max.rmsLevel ? a : max))
    : null;
  const silentCount = audioSegments.filter((a) => a.isSilent).length;

  const sections: string[] = [];

  sections.push(`You are a short-form video content analyst specializing in ad performance.
You have been given extracted data from a ${metadata.duration.toFixed(1)}s video
(${metadata.width}×${metadata.height}, aspect ${metadata.aspectRatio}, ${(metadata.fileSize / 1024 / 1024).toFixed(1)} MB).`);

  sections.push(`## Scene changes (${sceneChanges.length} detected)
${
  sceneChanges
    .map(
      (sc) =>
        `- ${sc.timestamp.toFixed(1)}s (confidence ${sc.score.toFixed(2)})`
    )
    .join("\n") || "- none detected"
}
Average pace: ${
    sceneChanges.length > 0
      ? `1 cut every ${(metadata.duration / sceneChanges.length).toFixed(1)}s`
      : "no clear cuts"
  }.`);

  sections.push(`## Motion (${motionSegments.length} segments, score 0–100)
${
  motionSegments
    .map(
      (m) =>
        `- ${m.startTime.toFixed(1)}–${m.endTime.toFixed(1)}s: ${m.interpretation} (${m.motionScore})`
    )
    .join("\n") || "- no motion data"
}`);

  sections.push(`## Audio (${audioSegments.length} × 0.1s buckets)
Silent buckets: ${silentCount}/${audioSegments.length}
${loudest ? `Loudest: ${loudest.rmsLevel.toFixed(1)} dB @ ${loudest.startTime.toFixed(1)}s` : ""}`);

  if (performance) {
    const lines = [
      performance.views === undefined
        ? ""
        : `- Views: ${performance.views.toLocaleString()}`,
      performance.completionRate === undefined
        ? ""
        : `- Completion rate: ${(performance.completionRate * 100).toFixed(1)}%`,
      performance.avgWatchTime === undefined
        ? ""
        : `- Avg watch time: ${performance.avgWatchTime.toFixed(1)}s`,
      performance.likes === undefined
        ? ""
        : `- Likes: ${performance.likes.toLocaleString()}`,
      performance.shares === undefined
        ? ""
        : `- Shares: ${performance.shares.toLocaleString()}`,
      performance.comments === undefined
        ? ""
        : `- Comments: ${performance.comments.toLocaleString()}`,
      performance.clickThroughRate === undefined
        ? ""
        : `- CTR: ${(performance.clickThroughRate * 100).toFixed(2)}%`,
      performance.costPerClick === undefined
        ? ""
        : `- CPC: $${performance.costPerClick.toFixed(2)}`,
      performance.costPerMille === undefined
        ? ""
        : `- CPM: $${performance.costPerMille.toFixed(2)}`,
      performance.platform ? `- Platform: ${performance.platform}` : "",
    ].filter(Boolean);
    if (lines.length > 0) {
      sections.push(`## Performance data\n${lines.join("\n")}`);
    }
  }

  sections.push(`## Your role
Analyze this video's content structure and explain its performance.
Focus on:
1. Hook effectiveness (first 3 seconds)
2. Pacing and scene-change rhythm
3. Audio dynamics (music, voiceover, silence)
4. Visual variety and engagement patterns
5. Narrative arc (problem→solution, storytelling, CTA)

Keyframes are provided as images in the first user message — analyze text overlays, faces,
framing, product placement, visual style, and CTA design. Reference exact timestamps.
Be specific and actionable. If performance data is provided, correlate visual features with metrics.`);

  return sections.join("\n\n");
}
