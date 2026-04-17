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
BATCH 4 BASE FIELD — AUDIENCE PROFILE (mandatory)
═══════════════════════════════════════════════════════════════════════════
Populate \`audienceProfile\` with your best inference about who this ad targets.
Never leave it null or empty — use "unclear" / "mixed" / "other" when uncertain.

### audienceProfile.primaryGender
Who the creative primarily addresses:
- "male" — masculine framing, imagery, voiceover address.
- "female" — feminine framing, imagery, voiceover address.
- "balanced" — explicit dual targeting or gender-neutral.
- "other" — non-binary or niche community targeting.

### audienceProfile.socioeconomic
Infer from price cues, aesthetics, aspirational language:
- "budget" — price-led, discount language, value messaging.
- "mainstream" — mid-market, broad accessibility, no luxury signals.
- "aspirational" — premium but attainable, style-forward imagery.
- "premium" — high-end without explicit luxury language.
- "luxury" — exclusive, heritage cues, status signaling.

### audienceProfile.urbanicity
- "urban" — city lifestyle, metropolitan references, dense environments.
- "suburban" — family-oriented, home/car ownership, mid-density.
- "rural" — outdoor, regional, slow-paced imagery.
- "mixed" — deliberately broad or ambiguous.

### audienceProfile.purchaseReadiness (funnel stage)
- "awareness" — introduces a new problem or category.
- "consideration" — compares, educates, shows differentiation.
- "decision" — CTA-heavy, urgency, offer-led.
- "retention" — loyalty, community, post-purchase usage.

### audienceProfile.lifestyleMarkers, values, pains, desires
3-6 short strings each. Be specific: "gym-goers", "sustainability-conscious",
"time-poor parents", "want visible results in 30 days". Avoid vague generics.

═══════════════════════════════════════════════════════════════════════════
V2 OUTPUT FORMAT — USE THIS SKELETON
═══════════════════════════════════════════════════════════════════════════
\`\`\`
${v2Skeleton}
\`\`\``;
