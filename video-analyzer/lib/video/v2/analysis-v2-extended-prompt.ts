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
BATCH 4 EXTENDED FIELDS (ALL MANDATORY — use best inference, never null)
═══════════════════════════════════════════════════════════════════════════

### eyeContact
Measure viewer-facing gaze coverage:
- \`overallScore\` (0-10): 0 = never looks at camera, 10 = constant direct address.
- \`directAddressPct\` (0-1): fraction of total runtime with clear direct gaze.
- \`perScene\`: for each scene window (use your scene timestamps) emit {start, end, pct}
  where pct is 0-1 eye-contact share for that window.
If there is no human talent (product-only video), set overallScore=0, directAddressPct=0, perScene=[].

### cutsMap
List EVERY visible edit (cut, dissolve, wipe, etc.) in chronological order, from
0s all the way through to the final frame. **Do NOT stop halfway.** Many ads
have faster pacing in the second half (payoff / CTA montage / logo-reveal) —
if your list gets sparser after the midpoint you are MISSING cuts. Explicitly
include the final cut-to-end-card / logo-reveal if present.

Sanity-check before submitting: if you report \`pacing.cutsPerMinute\` = 30,
then a 60-second video needs ≈30 entries; 90s needs ≈45; 120s needs ≈60.
Your list length must be broadly consistent with duration × cuts-per-minute.
If the metadata says duration = 99s and you have 9 cuts with the last at 50s,
that is wrong — keep going past the midpoint.

Per entry:
- \`timestamp\`: seconds at which the cut occurs.
- \`type\`: one of the enum values. "hard-cut" = clean frame cut; "jump-cut" =
  same-subject forward jump; "dissolve" = gradual blend; "fade-out" = close-to-
  black; "fade-in" = open-from-black.
- \`beforeShot\` / \`afterShot\`: 5-10 word description of the outgoing/incoming shot.
- \`intent\` (optional): "pace acceleration", "scene transition", "continuity cut".

Rough count expectations by duration:
- <15s: 4-15 cuts
- 15-30s: 8-25
- 30-60s: 15-50
- 60-120s: 30-100+
Fewer than 5 entries for a 60s+ video is almost certainly incomplete.

### peopleAnalysis
Objective observation of on-screen people — this is for creative research, not surveillance.
Use only what is visible in the video. Estimate, don't identify individuals.
- \`countMax\`: most people visible at once.
- \`countAvg\`: average across the runtime.
- \`overallGenderMix\`: fraction of screen time by broad gender presentation
  (male/female/other, must sum to 1.0).
- \`actors\`: one entry per distinct person. Assign stable IDs ("A1", "A2", …).
  - \`role\`: what function they serve in the ad.
  - \`gender\`: broad visual presentation — use "unclear" when genuinely ambiguous.
  - \`ageRange\`: estimated age bracket based on visual appearance only.
  - \`ethnicity\`: omit if indiscernible; use the broadest accurate descriptor when clear
    (e.g. "East Asian", "Black", "White", "South Asian", "Latina/o", "Middle Eastern").
    Never speculate; leave absent if unclear.
  - \`styleDescription\`: clothing, grooming, aesthetic (2-3 sentences).
  - \`appearanceTimeRanges\`: all time windows they are on screen.
  - \`screenTimePct\`: 0-1 fraction of total duration.
  - \`energyLevel\` (0-10), \`trustworthiness\` (0-10): based on performance/delivery.
  - \`eyeContactShare\` (0-1): their personal gaze-at-camera ratio while on screen.
  - \`cameraTreatment\`: dominant framing they receive.

### scriptAngle
Creative strategy framework:
- \`angle\`: the primary narrative structure (pick the best single fit).
- \`narrativeStyle\`: who the script speaks as/to.
- \`hookType\`: what mechanism the first 3 seconds uses to grab attention.
- \`thesis\`: one clear sentence — what does this video promise the viewer?
- \`acts\`: 2-5 structural acts with timestamps. Common 3-act: Setup/Turn/Payoff.
  For listicle: Intro/Points/CTA. Label naturally.
- \`copyHooks\`: the 3-6 most quotable, shareable, or memorable script lines verbatim.

═══════════════════════════════════════════════════════════════════════════
V2 OUTPUT FORMAT — USE THIS SKELETON
═══════════════════════════════════════════════════════════════════════════
\`\`\`
${v2ExtendedSkeleton}
\`\`\``;
