import { z } from "zod";

export const QwenAnalysisSchema = z.object({
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
  hook: z.object({
    score: z
      .number()
      .min(0)
      .max(10)
      .describe("Hook effectiveness 0-10 for first 3 seconds"),
    duration: z
      .number()
      .describe("Seconds the hook lasts before main content starts"),
    elements: z
      .array(z.string())
      .describe(
        "Techniques used e.g. 'face close-up', 'pattern interrupt', 'question', 'bold text'"
      ),
    rationale: z.string().describe("Why the hook works or doesn't"),
    improvements: z
      .array(z.string())
      .describe("Concrete changes to strengthen the hook"),
  }),
  pacing: z.object({
    score: z.number().min(0).max(10),
    cutsPerMinute: z.number(),
    rhythm: z.enum(["slow", "medium", "fast", "erratic"]),
    deadSpots: z
      .array(
        z.object({
          start: z.number(),
          end: z.number(),
          reason: z.string(),
        })
      )
      .describe("Time ranges where attention likely drops"),
    intensityCurve: z
      .array(
        z.object({
          time: z.number().describe("seconds"),
          intensity: z
            .number()
            .min(0)
            .max(10)
            .describe("expected viewer engagement 0-10"),
          note: z.string().describe("why intensity is where it is"),
        })
      )
      .describe(
        "Engagement over time, one sample per 1-2 seconds for plotting"
      ),
  }),
  scenes: z
    .array(
      z.object({
        start: z.number(),
        end: z.number(),
        label: z.string().describe("Short label e.g. 'Hook: POV opener'"),
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
        visualStyle: z
          .string()
          .describe("e.g. 'handheld close-up, warm tones'"),
        textOnScreen: z
          .string()
          .optional()
          .describe("OCR-detected text overlay if any"),
      })
    )
    .describe("Scene-by-scene breakdown"),
  cta: z.object({
    exists: z.boolean(),
    clarity: z.number().min(0).max(10),
    timing: z.string().describe("e.g. 'final 2 seconds', 'throughout', 'none'"),
    text: z.string().optional(),
    improvements: z.array(z.string()),
  }),
  audio: z.object({
    hasVoiceover: z.boolean().describe("Inferred from RMS patterns + visuals"),
    hasMusic: z.boolean(),
    voiceoverSummary: z
      .string()
      .optional()
      .describe("Gist of what's being said, inferred"),
    musicEnergy: z.enum(["low", "medium", "high"]).optional(),
    audioNotes: z
      .string()
      .describe("Observations about pacing, silence use, emphasis"),
  }),
  visual: z.object({
    variety: z.number().min(0).max(10),
    dominantColors: z.array(z.string()).describe("Hex colors"),
    mood: z.string(),
    textOverlayUsage: z.enum(["none", "minimal", "moderate", "heavy"]),
  }),
  targetAudience: z.object({
    ageRange: z.string().describe("e.g. '18-34'"),
    interests: z.array(z.string()),
    buyerStage: z
      .string()
      .describe("awareness | consideration | decision | retention"),
  }),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        area: z.enum([
          "hook",
          "pacing",
          "visual",
          "audio",
          "cta",
          "copy",
          "editing",
        ]),
        issue: z.string(),
        suggestion: z.string(),
        expectedImpact: z.string(),
      })
    )
    .describe("Sorted by priority, max ~8"),
  predictedMetrics: z.object({
    completionRate: z.enum(["low", "medium", "high"]),
    engagementRate: z.enum(["low", "medium", "high"]),
    rationale: z.string(),
  }),
});

export type QwenAnalysis = z.infer<typeof QwenAnalysisSchema>;
