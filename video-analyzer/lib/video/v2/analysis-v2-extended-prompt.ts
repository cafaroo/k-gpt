// lib/video/v2/analysis-v2-extended-prompt.ts
import { EXTENDED_SYSTEM_PROMPT_CORE } from "@/lib/video/analysis-extended-prompt";
import { schemaToSkeleton } from "@/lib/video/schema-to-skeleton";
import { AnalysisExtendedV2Schema } from "./analysis-v2-schema";

const v2ExtendedSkeleton = schemaToSkeleton(AnalysisExtendedV2Schema);

// Reuses v1's CORE guidance (rubrics, taxonomies, timestamp rules) but
// injects ONLY the v2 skeleton. Previously stacked two skeletons which
// pushed Gemini into terse output mode.
export const EXTENDED_V2_SYSTEM_PROMPT = `${EXTENDED_SYSTEM_PROMPT_CORE}

═══════════════════════════════════════════════════════════════════════════
V2 ADDITIONS — RESEARCH FIELDS (ALL MANDATORY, NEVER NULL)
═══════════════════════════════════════════════════════════════════════════
These fields are load-bearing for the whole v2 pipeline. If any of them is
null, empty, or missing the analysis is considered failed. You MUST emit a
concrete value for every one of them — use your best inference when uncertain.

Required v2 fields:
  colloquialityScore         — number 0-10 (video level)
  hookDissection.colloquialityScore — number 0-10 (first 3s)
  authenticityBand           — "low" | "moderate" | "high" (pick one, never null)
  brandHeritageSalience      — "absent" | "moderate" | "high" (pick one)
  audioExtended.voiceoverCadence — number (syllables/sec, > 0)
  emotionalFlowSequence      — emit []  (server fills)
  emotionalFlowMatchScore    — emit 0   (server fills)


### colloquialityScore (0-10, video-level) and hookDissection.colloquialityScore (0-10, first-3s)
Rubric (Zhang et al. 2025, JBR — single strongest predictor of engagement behaviors):
- 0-3: formal, scripted, no direct address, third-person, no contractions.
- 4-6: mixed — some casual moments or contractions but overall polished.
- 7-8: conversational — contractions, direct "you", slang, natural rhythm.
- 9-10: raw, colloquial — unfinished sentences, interjections ("ugh", "like"),
  trailing-off casual delivery, strong direct address.
Score based on voiceover + on-screen-text language combined.

### authenticityBand ("low" | "moderate" | "high"): Meng et al. 2024 U-shape
This is NOT a score, it's a band. The U-shape means BOTH low and high authenticity
outperform moderate.
- "high": feels like a real creator talking to the camera. Handheld, ambient,
  no production polish, genuine reactions. Purchase-intent favorable.
- "low": fully polished brand production — clean audio, studio lighting, on-brand
  color. Equally purchase-intent favorable because consumers know what it is.
- "moderate": in-between. UGC aesthetic with too-polished audio, or polished
  visuals with fake handheld. This is the danger zone the research flags.

### brandHeritageSalience ("absent" | "moderate" | "high")
How prominent are brand-heritage cues (age, history, founders, origin story)?
Research (Meng 2024): also U-shaped. Both absent (novelty) and high (trust)
outperform moderate (which reads as insecure brand positioning).

### audioExtended.voiceoverCadence (numeric, syllables/sec)
Estimate the average voiceover cadence in syllables per second across speaking
segments (exclude silence). English natural speech is 3-5 syl/sec; "rapid" UGC
hits 6-8; slow/contemplative under 3. This upgrades v1's qualitative
voiceoverPace to a measurable number.

### emotionalArc[].transitionFromPrevious (optional enum)
For each emotionalArc entry after the first, classify how the emotion got here:
- "smooth": continuous evolution from previous.
- "hard-cut": abrupt shift (often at a scene cut).
- "escalation": same emotion family, intensified.
- "release": emotional tension drops.

### emotionalFlowSequence + emotionalFlowMatchScore
Server computes these post-hoc from emotionalArc — emit as [] and 0. Do not
attempt to populate.

═══════════════════════════════════════════════════════════════════════════
V2 OUTPUT FORMAT — USE THIS SKELETON
═══════════════════════════════════════════════════════════════════════════
\`\`\`
${v2ExtendedSkeleton}
\`\`\``;
