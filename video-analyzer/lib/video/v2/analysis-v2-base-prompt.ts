// lib/video/v2/analysis-v2-base-prompt.ts
import { QWEN_SYSTEM_PROMPT } from "@/lib/video/qwen-prompt";
import { schemaToSkeleton } from "@/lib/video/schema-to-skeleton";
import { QwenAnalysisV2Schema } from "./analysis-v2-schema";

const v2Skeleton = schemaToSkeleton(QwenAnalysisV2Schema);

// Stitch v2-specific guidance onto the v1 prompt. The v1 prompt already
// carries rules, taxonomy, few-shot examples, and timestamp format
// requirements — v2 only needs to (a) announce the added fields and
// (b) inject the new skeleton. The base pass does NOT compute ECR/NAWP
// (those are server-side post-hoc) — but it DOES sample scene complexity.
export const QWEN_V2_SYSTEM_PROMPT = `${QWEN_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════
V2 ADDITIONS — SCENE COMPLEXITY (mandatory)
═══════════════════════════════════════════════════════════════════════════
For every scene in \`scenes\`, ALSO emit a matching entry in \`pacing.sceneComplexity\`:
  { "start": <seconds>, "complexity": <0-10> }
Complexity = density of visual information (number of distinct objects, text overlay density, motion amount, color variety). A product close-up with clean background = 2-3. A crowded market scene with overlays = 8-9.

V2 fields \`pacing.complexityAdjustedRhythm\`, \`predictedMetrics.ecr\`, \`predictedMetrics.nawp\`, \`predictedMetrics.ecrRationale\`, \`predictedMetrics.nawpRationale\`: emit as 0 and empty strings. Server computes them post-hoc.

═══════════════════════════════════════════════════════════════════════════
V2 OUTPUT FORMAT — USE THIS SKELETON
═══════════════════════════════════════════════════════════════════════════
\`\`\`
${v2Skeleton}
\`\`\``;
