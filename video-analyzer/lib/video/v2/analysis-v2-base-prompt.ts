// lib/video/v2/analysis-v2-base-prompt.ts
import { QWEN_SYSTEM_PROMPT_CORE } from "@/lib/video/qwen-prompt";
import { schemaToSkeleton } from "@/lib/video/schema-to-skeleton";
import { QwenAnalysisV2Schema } from "./analysis-v2-schema";

const v2Skeleton = schemaToSkeleton(QwenAnalysisV2Schema);

// V2 reuses v1's analytical CORE (rules, taxonomy, examples, timestamp
// format) but injects only ONE skeleton — the v2 one. Stacking two
// skeletons (~50k chars) caused Gemini to emit "light mode" output with
// 60-80% fewer array items.
export const QWEN_V2_SYSTEM_PROMPT = `${QWEN_SYSTEM_PROMPT_CORE}

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
