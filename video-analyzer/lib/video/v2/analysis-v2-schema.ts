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
});
export type AnalysisExtendedV2 = z.infer<typeof AnalysisExtendedV2Schema>;

export type AnalysisV2Combined = QwenAnalysisV2 & {
  extended?: AnalysisExtendedV2;
  extendedError?: string;
};
