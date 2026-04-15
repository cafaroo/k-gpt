/**
 * Rule bank — patterns that correlated with better engagement in the
 * 10k+ TikTok/Reels/Shorts dataset.
 *
 * These are injected verbatim into Qwen's system prompt so it scores each
 * video against them. They also serve as UI chips ("rule compliance") later.
 */

export type Rule = {
  id: string;
  category: "hook" | "pacing" | "text" | "audio" | "cta" | "structure";
  title: string;
  detail: string;
  // How Qwen should judge whether the rule is met
  checkInstruction: string;
};

export const UNIVERSAL_RULES: Rule[] = [
  {
    id: "hook-problem-first",
    category: "hook",
    title: "Open problem-first, contrarian, or with micro-proof",
    detail:
      "These three hook styles consistently outperform generic or curiosity-only openers.",
    checkInstruction:
      "Classify the opening style. Met if primary hook style is problem-first, contrarian, or micro-proof.",
  },
  {
    id: "pacing-visual-change-first-3s",
    category: "pacing",
    title: "Visible change in 0:02–0:03",
    detail:
      "A cut, zoom, B-roll swap, or camera movement inside the first 2-3 seconds correlates with stronger retention.",
    checkInstruction:
      "Detect time of first visual change (cut / zoom / angle change). Met if ≤ 3.0 seconds.",
  },
  {
    id: "text-in-first-frame",
    category: "text",
    title: "On-screen text in frame 1",
    detail:
      "A keyword or benefit as text in the very first frame lifts hook strength.",
    checkInstruction:
      "Check if frame 0 contains readable text. Met if yes AND text contains a keyword/benefit (not just decorative).",
  },
  {
    id: "text-captions-with-vo",
    category: "text",
    title: "Captions + VO beat VO-only in info-heavy niches",
    detail:
      "Instructional/info content performs better with running captions on top of voiceover.",
    checkInstruction:
      "If the video has a voiceover (inferred) and is in an info-heavy niche, check for running captions. Met if both present.",
  },
  {
    id: "clarity-beats-clever",
    category: "text",
    title: "Clarity beats clever",
    detail:
      'Straightforward claims ("I spent $24 on this and…") outperform vague teases ("you won\'t believe…").',
    checkInstruction:
      "Rate claim clarity 0-10. Met if ≥ 7 and first hook text is a concrete claim, not a vague tease.",
  },
  {
    id: "early-payoff",
    category: "structure",
    title: "Show outcome early",
    detail:
      "An early glimpse of the payoff (before/after, result, end-state) outperforms delayed reveals.",
    checkInstruction:
      "Detect when the outcome/payoff is first visible. Met if first glimpse is within first 30% of video duration.",
  },
  {
    id: "cta-native",
    category: "cta",
    title: "Native CTAs win",
    detail:
      '"save this", "comment \'recipe\' for the link", "DM me \'hook\'" outperform hard sells.',
    checkInstruction:
      "Classify CTA type. Met if CTA is native (save/comment/dm/follow/watch-again) OR bio-link with soft phrasing.",
  },
  {
    id: "beat-map-canonical",
    category: "structure",
    title: "Canonical beat map",
    detail: "hook → micro-proof → how-to/steps → soft-CTA in last 2s.",
    checkInstruction:
      "Check if detected beats roughly follow: hook (0-2s), micro-proof (2-4s), steps (4s to near end), cta (last 2s). Met if at least 3 of the 4 beats land in their canonical windows.",
  },
  {
    id: "audio-clean",
    category: "audio",
    title: "Prioritize clean audio over trendy tracks",
    detail: "Clarity of VO drives performance more than music choice.",
    checkInstruction:
      "Judge audio clarity from RMS data. Met if voiceover likely present and audio looks clean (stable, not overpowered by music).",
  },
  {
    id: "micro-cta-early",
    category: "cta",
    title: "Early micro-CTA aids retention",
    detail:
      '"Watch the end for the side-by-side" early in the video boosts completion.',
    checkInstruction:
      "Check if any retention hook exists in first half (text/visual cue promising a later reveal). Met if yes.",
  },
];

// ─── Niche playbooks ────────────────────────────────────────────────────────
// Niche-specific heuristics that Qwen should check in addition to universal rules.

export type NichePlaybook = {
  niche: string;
  checks: { id: string; label: string; instruction: string }[];
};

export const NICHE_PLAYBOOKS: NichePlaybook[] = [
  {
    niche: "beauty",
    checks: [
      {
        id: "beauty-proof-visuals",
        label: "Proof visuals + early result glimpse",
        instruction:
          "Check for before/after or in-progress result frames within first 40% of video.",
      },
      {
        id: "beauty-captions",
        label: "Captions present",
        instruction: "Check running captions are on.",
      },
    ],
  },
  {
    niche: "home-diy",
    checks: [
      {
        id: "diy-materials-onscreen",
        label: "Materials shown on-screen with labels",
        instruction:
          "Early frames should show material list or product labels.",
      },
      {
        id: "diy-fast-cuts",
        label: "Fast cuts between steps",
        instruction: "Met if cuts/10s ≥ 4 in steps section.",
      },
    ],
  },
  {
    niche: "fitness",
    checks: [
      {
        id: "fitness-timer-reps",
        label: "Timer overlays / rep counts",
        instruction: "Check for numeric overlays indicating time or reps.",
      },
      {
        id: "fitness-focused-vo",
        label: "VO stays focused (no meandering)",
        instruction:
          "Met if voiceover density looks tight and no long silent/irrelevant stretches.",
      },
    ],
  },
  {
    niche: "saas-ai-tools",
    checks: [
      {
        id: "saas-screen-rec",
        label: "Screen recording with large text + cursor highlights",
        instruction:
          "Primary format should include screen recording. Check for big text or cursor emphasis.",
      },
      {
        id: "saas-promise-demo-recap",
        label: "promise → demo → recap structure",
        instruction:
          "Met if beat sequence roughly: promise (hook) → demo (steps) → recap at end.",
      },
    ],
  },
  {
    niche: "food",
    checks: [
      {
        id: "food-overhead-shots",
        label: "Overhead or close-up cooking shots",
        instruction: "Check for overhead/close-up shots of food preparation.",
      },
    ],
  },
];
