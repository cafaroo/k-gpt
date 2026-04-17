// lib/video/v2/analysis-v2-schema.ts
import { z } from "zod";
import { AnalysisExtendedSchema } from "@/lib/video/analysis-extended-schema";
import { QwenAnalysisSchema, score10 } from "@/lib/video/qwen-schema";

export const ANALYSIS_V2_SCHEMA_VERSION = "2026.04-v2";

export const QwenAnalysisV2Schema = QwenAnalysisSchema.extend({
  schemaVersion: z.string().default(ANALYSIS_V2_SCHEMA_VERSION),
  pacing: QwenAnalysisSchema.shape.pacing.extend({
    sceneComplexity: z
      .array(
        z.object({
          start: z.number(),
          complexity: score10,
        })
      )
      .describe("Per-scene visual complexity 0-10 for post-hoc rhythm calc"),
    complexityAdjustedRhythm: z
      .number()
      .describe("cutsPerMinute / mean(sceneComplexity), server-computed"),
  }),
  predictedMetrics: QwenAnalysisSchema.shape.predictedMetrics.extend({
    ecr: z.number().describe("0-1 probability watch > 5s, server-computed"),
    nawp: z.number().describe("0-1 normalized average watch, server-computed"),
    ecrRationale: z.string(),
    nawpRationale: z.string(),
  }),
  // Batch 4: expanded audience profile (base pass — creative strategy)
  audienceProfile: z.object({
    primaryAgeRange: z.string(),
    primaryGender: z.enum(["male", "female", "balanced", "other"]),
    socioeconomic: z.enum([
      "budget",
      "mainstream",
      "aspirational",
      "premium",
      "luxury",
    ]),
    urbanicity: z.enum(["urban", "suburban", "rural", "mixed"]),
    region: z
      .string()
      .optional()
      .describe("Broad region or country if discernible"),
    lifestyleMarkers: z.array(z.string()),
    values: z
      .array(z.string())
      .describe(
        "Psychographic values, e.g. 'health-conscious', 'value-seekers'"
      ),
    pains: z.array(z.string()),
    desires: z.array(z.string()),
    purchaseReadiness: z.enum([
      "awareness",
      "consideration",
      "decision",
      "retention",
    ]),
  }),
});
export type QwenAnalysisV2 = z.infer<typeof QwenAnalysisV2Schema>;

const extendedEmotionalArcItem =
  AnalysisExtendedSchema.shape.emotionalArc.element.extend({
    transitionFromPrevious: z
      .enum(["smooth", "hard-cut", "escalation", "release"])
      .optional(),
  });

export const AnalysisExtendedV2Schema = AnalysisExtendedSchema.extend({
  colloquialityScore: score10.describe(
    "0-10 video-level colloquiality (Zhang 2025)"
  ),
  authenticityBand: z
    .enum(["low", "moderate", "high"])
    .describe("Meng 2024 U-shape — moderate is danger zone"),
  brandHeritageSalience: z.enum(["absent", "moderate", "high"]),
  audioExtended: AnalysisExtendedSchema.shape.audioExtended.extend({
    voiceoverCadence: z.number().describe("Syllables per second, numeric"),
  }),
  hookDissection: AnalysisExtendedSchema.shape.hookDissection.extend({
    colloquialityScore: score10.describe("0-10 first-3s colloquiality"),
  }),
  emotionalArc: z.array(extendedEmotionalArcItem),
  emotionalFlowSequence: z
    .array(z.string())
    .describe("Reduced primary-emotion sequence, server-computed"),
  emotionalFlowMatchScore: score10.describe(
    "0-10 match against high-performing bigram patterns"
  ),

  // ── Batch 4 ──────────────────────────────────────────────────────────────

  // Eye contact — per-scene coverage of viewer-facing gaze
  eyeContact: z.object({
    overallScore: score10.describe(
      "0-10 — how often talent looks at camera"
    ),
    directAddressPct: z
      .number()
      .describe("0-1 share of runtime with direct address"),
    perScene: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        pct: z.number(),
      })
    ),
  }),

  // Full cuts mapping (cuts = visible edits, distinct from scene changes)
  cutsMap: z.array(
    z.object({
      timestamp: z.number(),
      type: z.enum([
        "hard-cut",
        "jump-cut",
        "match-cut",
        "dissolve",
        "cross-dissolve",
        "fade-in",
        "fade-out",
        "wipe",
        "whip-pan",
        "zoom-cut",
        "other",
      ]),
      beforeShot: z.string().describe("Short description of the outgoing shot"),
      afterShot: z.string().describe("Short description of the incoming shot"),
      intent: z
        .string()
        .optional()
        .describe("Why this cut is here"),
    })
  ),

  // People analysis — aggregate + per-actor
  peopleAnalysis: z.object({
    countMax: z.number(),
    countAvg: z.number(),
    overallGenderMix: z.object({
      male: z.number(),
      female: z.number(),
      other: z.number(),
    }),
    actors: z.array(
      z.object({
        id: z
          .string()
          .describe(
            "Stable identifier within this analysis, e.g. 'A1'"
          ),
        role: z.enum([
          "presenter",
          "ugc-creator",
          "testimonial",
          "expert",
          "actor-silent",
          "crowd",
          "voiceover-only",
          "other",
        ]),
        gender: z.enum(["male", "female", "non-binary", "unclear"]),
        ageRange: z.enum([
          "child",
          "teen",
          "18-24",
          "25-34",
          "35-44",
          "45-54",
          "55-64",
          "65+",
          "unclear",
        ]),
        ethnicity: z
          .string()
          .optional()
          .describe("Broad group if discernible"),
        styleDescription: z.string(),
        appearanceTimeRanges: z.array(
          z.object({ start: z.number(), end: z.number() })
        ),
        screenTimePct: z.number(),
        energyLevel: score10,
        trustworthiness: score10,
        eyeContactShare: z
          .number()
          .describe("0-1 share of on-screen time with direct gaze"),
        cameraTreatment: z.enum([
          "close-up-heavy",
          "medium",
          "wide",
          "mixed",
        ]),
      })
    ),
  }),

  // Script angle — creative strategy the script is built around
  scriptAngle: z.object({
    angle: z.enum([
      "problem-solution",
      "before-after",
      "listicle",
      "testimonial",
      "tutorial",
      "challenge",
      "contrarian",
      "storytime",
      "ugc-reaction",
      "comparison",
      "mythbust",
      "curiosity-tease",
      "day-in-the-life",
      "expert-explainer",
      "other",
    ]),
    narrativeStyle: z.enum([
      "first-person",
      "second-person",
      "third-person",
      "dialogue",
      "monologue",
      "narration",
    ]),
    hookType: z.enum([
      "stat-drop",
      "question",
      "bold-claim",
      "visual-reveal",
      "contrarian",
      "pattern-interrupt",
      "emotional-hook",
      "story-tease",
      "other",
    ]),
    thesis: z.string().describe("One-sentence core promise of the video"),
    acts: z.array(
      z.object({
        name: z
          .string()
          .describe("Act label, e.g. 'Setup', 'Turn', 'Payoff'"),
        start: z.number(),
        end: z.number(),
        summary: z.string(),
      })
    ),
    copyHooks: z
      .array(z.string())
      .describe("Quotable copy lines from the script"),
  }),
});
export type AnalysisExtendedV2 = z.infer<typeof AnalysisExtendedV2Schema>;

export type AnalysisV2Combined = QwenAnalysisV2 & {
  extended?: AnalysisExtendedV2;
  extendedError?: string;
};
