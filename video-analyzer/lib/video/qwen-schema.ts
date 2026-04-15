import { z } from "zod";
import {
  BEAT_TYPES,
  CTA_ASK_SIZES,
  CTA_TYPES,
  FORMATS,
  GOAL_ALIGNMENTS,
  HOOK_STYLES,
  NICHES,
  PERFORMANCE_LEVELS,
  SHOT_TYPES,
  TEXT_POSITIONS,
  TEXT_STYLES,
} from "./framework/taxonomy";

export const QwenAnalysisSchema = z.object({
  // ─── Overall ────────────────────────────────────────────────────────────
  overall: z.object({
    score: z
      .number()
      .min(0)
      .max(100)
      .describe("Overall ad quality score 0-100"),
    tagline: z
      .string()
      .describe("One-line summary like 'Strong hook, weak CTA'"),
    summary: z.string().describe("2-3 sentence executive summary"),
  }),

  // ─── Hook (extended with taxonomy) ──────────────────────────────────────
  hook: z.object({
    score: z.number().min(0).max(10),
    duration: z.number().describe("Seconds the hook lasts before main content"),
    primaryStyle: z
      .enum(HOOK_STYLES)
      .describe("Dominant hook style"),
    secondaryStyles: z
      .array(z.enum(HOOK_STYLES))
      .describe("Additional hook styles present, if any"),
    timeToFirstVisualChange: z
      .number()
      .describe(
        "Seconds until first cut / zoom / B-roll swap / camera move. Lower = stronger hook.",
      ),
    textInFirstFrame: z.object({
      present: z.boolean(),
      text: z.string().optional(),
      keywordFirst: z
        .boolean()
        .describe(
          "True if first on-screen text leads with a keyword/benefit (not a vague tease)",
        ),
    }),
    elements: z.array(z.string()),
    rationale: z.string(),
    improvements: z.array(z.string()),
  }),

  // ─── Beat map ───────────────────────────────────────────────────────────
  beatMap: z
    .array(
      z.object({
        type: z.enum(BEAT_TYPES),
        start: z.number(),
        end: z.number(),
        description: z.string(),
        strength: z.number().min(0).max(10),
      }),
    )
    .describe(
      "Sequence of story beats. Canonical pattern: hook → micro-proof → how-to → soft-cta",
    ),

  payoffTiming: z.object({
    firstGlimpseAt: z
      .number()
      .nullable()
      .describe("Seconds until viewer first sees the outcome/payoff"),
    fullRevealAt: z.number().nullable(),
    isEarly: z
      .boolean()
      .describe("True if first glimpse is within first 30% of duration"),
  }),

  // ─── Pacing (kept) ──────────────────────────────────────────────────────
  pacing: z.object({
    score: z.number().min(0).max(10),
    cutsPerMinute: z.number(),
    rhythm: z.enum(["slow", "medium", "fast", "erratic"]),
    deadSpots: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        reason: z.string(),
      }),
    ),
    intensityCurve: z
      .array(
        z.object({
          time: z.number(),
          intensity: z.number().min(0).max(10),
          note: z.string(),
        }),
      )
      .describe("Engagement over time, one sample per 1-2 seconds"),
  }),

  // ─── Scenes (kept) ──────────────────────────────────────────────────────
  scenes: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      label: z.string(),
      function: z.enum([
        "hook",
        "problem",
        "product-intro",
        "social-proof",
        "demo",
        "benefit",
        "cta",
        "transition",
        "other",
      ]),
      description: z.string(),
      visualStyle: z.string(),
      textOnScreen: z.string().optional(),
    }),
  ),

  // ─── On-screen text (full event list + coverage stats) ──────────────────
  onScreenText: z.object({
    events: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        style: z.enum(TEXT_STYLES),
        position: z.enum(TEXT_POSITIONS),
      }),
    ),
    coverageRatio: z
      .number()
      .min(0)
      .max(1)
      .describe("Fraction of runtime with any on-screen text"),
    captionsVsOverlay: z.enum([
      "captions-only",
      "overlay-only",
      "mixed",
      "none",
    ]),
    keywordFirst: z.boolean(),
    claimClarity: z
      .number()
      .min(0)
      .max(10)
      .describe("0 = vague tease, 10 = concrete claim"),
    pricesShown: z.array(
      z.object({ value: z.string(), timestamp: z.number() }),
    ),
  }),

  // ─── CTA (extended taxonomy) ────────────────────────────────────────────
  cta: z.object({
    exists: z.boolean(),
    type: z.enum(CTA_TYPES),
    text: z.string().optional(),
    clarity: z.number().min(0).max(10),
    timing: z.enum(["start", "middle", "end", "throughout", "none"]),
    askSize: z.enum(CTA_ASK_SIZES),
    nativenessScore: z
      .number()
      .min(0)
      .max(10)
      .describe("10 = fully native; 0 = hard sell"),
    microCTAEarly: z
      .boolean()
      .describe("Does an early 'watch till end for…' cue exist?"),
    improvements: z.array(z.string()),
  }),

  // ─── Audio (kept) ───────────────────────────────────────────────────────
  audio: z.object({
    hasVoiceover: z.boolean(),
    hasMusic: z.boolean(),
    voiceoverDensity: z
      .enum(["sparse", "moderate", "dense"])
      .optional()
      .describe("Inferred from RMS variance and silent stretches"),
    voiceoverSummary: z.string().optional(),
    musicEnergy: z.enum(PERFORMANCE_LEVELS).optional(),
    audioVisualSync: z
      .enum(["tight", "loose", "unrelated"])
      .optional()
      .describe("Do cuts align with audio beats?"),
    audioNotes: z.string(),
  }),

  // ─── Visual language (extended) ─────────────────────────────────────────
  visual: z.object({
    variety: z.number().min(0).max(10),
    dominantColors: z.array(z.string()),
    mood: z.string(),
    textOverlayUsage: z.enum(["none", "minimal", "moderate", "heavy"]),
    shotTypes: z.array(z.enum(SHOT_TYPES)),
    cameraMovement: z.enum(["static", "handheld", "dynamic", "mixed"]),
    dominantFaceRatio: z
      .number()
      .min(0)
      .max(1)
      .describe("Fraction of frames with a visible human face"),
    brandingVisibility: z.enum(["none", "subtle", "moderate", "heavy"]),
  }),

  // ─── Format ─────────────────────────────────────────────────────────────
  format: z.object({
    primary: z.enum(FORMATS),
    secondary: z.enum(FORMATS).optional(),
    goalAlignment: z.enum(GOAL_ALIGNMENTS),
  }),

  // ─── Niche (with playbook compliance) ───────────────────────────────────
  niche: z.object({
    detected: z.enum(NICHES),
    confidence: z.number().min(0).max(1),
    playbookCompliance: z.array(
      z.object({
        ruleId: z.string().describe("ID from NICHE_PLAYBOOKS"),
        label: z.string(),
        met: z.boolean(),
        note: z.string(),
      }),
    ),
  }),

  // ─── Target audience (kept) ─────────────────────────────────────────────
  targetAudience: z.object({
    ageRange: z.string(),
    interests: z.array(z.string()),
    buyerStage: z.string(),
  }),

  // ─── Universal rule compliance ──────────────────────────────────────────
  ruleCompliance: z
    .array(
      z.object({
        ruleId: z
          .string()
          .describe("ID from UNIVERSAL_RULES (e.g. 'hook-problem-first')"),
        title: z.string(),
        met: z.boolean(),
        score: z.number().min(0).max(10).optional(),
        evidence: z
          .string()
          .describe("Concrete evidence citing a timestamp"),
      }),
    )
    .describe("Score this video against each universal rule"),

  // ─── Performance proxies (extended) ─────────────────────────────────────
  predictedMetrics: z.object({
    completionRate: z.enum(PERFORMANCE_LEVELS),
    engagementRate: z.enum(PERFORMANCE_LEVELS),
    holdTo3sScore: z
      .number()
      .min(0)
      .max(10)
      .describe("Predicted % of viewers reaching 3s"),
    saveLikelihood: z.number().min(0).max(10),
    commentLikelihood: z.number().min(0).max(10),
    shareLikelihood: z.number().min(0).max(10),
    rationale: z.string(),
  }),

  // ─── Recommendations (extended with testable variants) ──────────────────
  recommendations: z.array(
    z.object({
      priority: z.enum(["high", "medium", "low"]),
      area: z.enum(["hook", "pacing", "visual", "audio", "cta", "copy", "editing"]),
      issue: z.string(),
      suggestion: z.string(),
      expectedImpact: z.string(),
      testVariant: z
        .string()
        .optional()
        .describe(
          "Concrete A/B variant to ship, e.g. 'Try contrarian hook: Stop double-cleansing — do this instead'",
        ),
    }),
  ),

  // ─── Repeatable test plan (user's next-week plan) ───────────────────────
  testPlan: z.object({
    hookVariants: z
      .array(
        z.object({
          style: z.enum(HOOK_STYLES),
          draft: z.string().describe("Ready-to-shoot hook line"),
        }),
      )
      .describe("3 hook drafts in different styles"),
    structureVariants: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
        }),
      )
      .describe(
        "2 structure variants to test (e.g. early-result vs delayed-result)",
      ),
    measurablePriority: z.array(
      z.enum(["hold-to-3s", "saves", "comments", "shares", "completion"]),
    ),
    notes: z.string(),
  }),
});

export type QwenAnalysis = z.infer<typeof QwenAnalysisSchema>;
