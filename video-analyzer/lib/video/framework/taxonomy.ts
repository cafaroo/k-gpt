/**
 * Extraction framework — taxonomies for short-form ad analysis.
 *
 * These enums mirror patterns observed across 10k+ TikTok/Reels/Shorts videos.
 * They are the vocabulary Qwen uses when classifying each video. Later, batch
 * aggregation over many videos uses these same tokens to find what actually
 * correlates with engagement proxies (saves, comments, shares, completion).
 */

// ─── Hook styles ────────────────────────────────────────────────────────────
// Open with one of these in the first 0-3 seconds to lift hold rates.
export const HOOK_STYLES = [
  "problem-first", // "My skin hates winter. Here's what fixed it."
  "contrarian", // "Stop double-cleansing — do this instead."
  "micro-proof", // "I used this for 7 days — look at day 7."
  "confession", // "I wasted $300 on serums until…"
  "price-reveal", // "This is $14 and beats the $60 one."
  "question", // "What if your hook is the problem?"
  "bold-claim", // "This is the best CTA I've ever tested."
  "curiosity-gap", // "You won't believe what happened at 0:12…" (weaker; track it)
  "list-promise", // "3 hooks that hit 70% hold."
  "result-tease", // "Watch until the end to see the full before/after."
  "pattern-interrupt", // visual/audio shock
  "pov", // "POV: you're about to lose a client…"
  "other",
] as const;
export type HookStyle = (typeof HOOK_STYLES)[number];

// ─── Beat types ─────────────────────────────────────────────────────────────
// The atomic units of a short-form video's structure.
export const BEAT_TYPES = [
  "hook", // 0-2s opener
  "problem", // Introduce the pain
  "micro-proof", // Quick result/clip, early credibility
  "how-to-step", // Tutorial/steps segment
  "payoff", // Full reveal / before-after outcome
  "benefit", // Spell out the gain
  "social-proof", // Testimonial / quote / count
  "objection", // Address a "yeah but…"
  "product-intro", // Name/show the product
  "transition", // Visual break, not story-critical
  "soft-cta", // "Save this", "comment X"
  "hard-cta", // "Link in bio", "buy now"
  "reveal", // Dramatic reveal distinct from payoff
  "recap", // Quick summary at end
  "other",
] as const;
export type BeatType = (typeof BEAT_TYPES)[number];

// Canonical beat map that correlates with higher hold rates.
export const CANONICAL_BEAT_MAP = [
  { beat: "hook", window: "0:00–0:02" },
  { beat: "micro-proof", window: "0:02–0:04" },
  { beat: "how-to-step", window: "0:04–0:15" },
  { beat: "soft-cta", window: "last 2s" },
] as const;

// ─── CTA taxonomy ───────────────────────────────────────────────────────────
// Native > hard-sell for short-form.
export const CTA_TYPES = [
  "native-save", // "save this for later"
  "native-comment", // "comment 'recipe' for the link"
  "native-dm", // "DM me 'hook' for the template"
  "native-follow", // "follow for more"
  "native-watch-again", // "watch the end for the side-by-side"
  "link-in-bio", // "exact kit in bio"
  "hard-sell-url", // "go to mysite.com/buy"
  "hard-sell-product", // "buy now", "swipe up"
  "soft-question", // "which one would you pick?"
  "none",
] as const;
export type CTAType = (typeof CTA_TYPES)[number];

export const CTA_ASK_SIZES = ["small", "medium", "large"] as const;
export type CTAAskSize = (typeof CTA_ASK_SIZES)[number];

// ─── Format ─────────────────────────────────────────────────────────────────
export const FORMATS = [
  "testimonial", // conversion-leaning
  "routine", // step-by-step; great for saves
  "reaction", // awareness / shares
  "before-after", // strong across beauty/home/fitness
  "screen-recording", // SaaS/AI/tools
  "tutorial", // how-to heavy
  "duet-stitch",
  "list", // "3 things…"
  "storytime",
  "unboxing",
  "montage",
  "explainer",
  "other",
] as const;
export type Format = (typeof FORMATS)[number];

export const GOAL_ALIGNMENTS = [
  "awareness", // comments/shares
  "consideration", // saves
  "conversion", // clicks/buys
  "retention", // re-watch / follow
] as const;
export type GoalAlignment = (typeof GOAL_ALIGNMENTS)[number];

// ─── Niches ─────────────────────────────────────────────────────────────────
export const NICHES = [
  "beauty", // skincare, makeup, hair
  "wellness", // supplements, fitness-lifestyle
  "fitness", // workouts, training
  "home-diy", // home projects, cleaning
  "fashion",
  "food", // recipes, cooking
  "saas-ai-tools", // software demos
  "finance",
  "education",
  "creators", // creator tips, content about content
  "lifestyle",
  "other",
] as const;
export type Niche = (typeof NICHES)[number];

// ─── Shot types ─────────────────────────────────────────────────────────────
export const SHOT_TYPES = [
  "close-up",
  "medium",
  "wide",
  "product-shot",
  "text-card",
  "screen-recording",
  "split-screen",
  "overhead",
  "pov",
  "b-roll",
  "face-on-camera",
  "other",
] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

// ─── Text-on-screen styles ──────────────────────────────────────────────────
export const TEXT_STYLES = [
  "caption", // running VO captions
  "title", // big headline card
  "label", // product/step labels
  "overlay", // decorative text
  "subtitle",
] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

export const TEXT_POSITIONS = ["top", "center", "bottom", "side"] as const;
export type TextPosition = (typeof TEXT_POSITIONS)[number];

// ─── Performance proxies ────────────────────────────────────────────────────
export const PERFORMANCE_LEVELS = ["low", "medium", "high"] as const;
export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number];
