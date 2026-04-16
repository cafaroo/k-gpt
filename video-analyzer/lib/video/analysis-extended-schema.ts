import { z } from "zod";
import { score10 } from "./qwen-schema";

/**
 * Second-pass schema containing the rich audio/retention fields that push a
 * single schema over Google's "too many states" structured-output limit.
 * Kept in its own generateObject call so both passes stay under the limit.
 */
export const AnalysisExtendedSchema = z.object({
  // ─── Full verbatim transcript ───────────────────────────────────────────
  transcript: z.object({
    language: z.string().describe("ISO code, e.g. 'en', 'sv'"),
    segments: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        speaker: z.string().optional(),
      })
    ),
    fullText: z.string(),
  }),

  // ─── Extended audio landscape ───────────────────────────────────────────
  audioExtended: z.object({
    voiceoverTone: z
      .array(z.string())
      .describe(
        "Tone tags, e.g. ['casual', 'authoritative', 'warm', 'urgent']"
      ),
    voiceoverPace: z.enum(["slow", "natural", "rapid", "variable"]).optional(),
    music: z.object({
      present: z.boolean(),
      genre: z.string().optional(),
      mood: z.string().optional(),
      energyCurve: z.array(z.object({ time: z.number(), energy: score10 })),
      beatSync: z
        .enum(["tight", "loose", "none", "intentional-off"])
        .optional(),
      drops: z.array(z.object({ timestamp: z.number(), effect: z.string() })),
    }),
    ambientSounds: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        description: z.string(),
        role: z.enum([
          "atmosphere",
          "realism-cue",
          "distraction",
          "narrative-element",
        ]),
      })
    ),
    soundEffects: z.array(
      z.object({
        timestamp: z.number(),
        sfx: z.string(),
        purpose: z.string(),
      })
    ),
    silenceMoments: z.array(
      z.object({ start: z.number(), end: z.number(), impact: z.string() })
    ),
    audioDensity: z.enum(["sparse", "moderate", "dense", "overwhelming"]),
  }),

  // ─── Hook dissection (0-3s) ─────────────────────────────────────────────
  hookDissection: z.object({
    firstSecond: z.object({
      visualDescription: z.string(),
      audioEvent: z.string(),
      textOnScreen: z.string().optional(),
      attentionTriggers: z.array(z.string()),
      promiseEstablished: z.string(),
    }),
    firstThreeSeconds: z.array(
      z.object({
        second: z.number(),
        visual: z.string(),
        audio: z.string(),
        text: z.string().optional(),
        tension: score10,
      })
    ),
    curiosityGap: z.object({
      present: z.boolean(),
      description: z.string(),
      resolvesAt: z.number().nullable(),
    }),
    stopPower: score10,
  }),

  // ─── Per-second swipe-risk curve ────────────────────────────────────────
  swipeRiskCurve: z.array(
    z.object({ second: z.number(), risk: score10, reason: z.string() })
  ),

  // ─── Attention-recapture moments ────────────────────────────────────────
  patternInterrupts: z.array(
    z.object({
      timestamp: z.number(),
      type: z
        .string()
        .describe(
          "visual-cut | audio-spike | unexpected-element | rhetorical-question | reveal | person-appears | scale-change | color-shift | sound-effect | text-flash | zoom"
        ),
      description: z.string(),
      effectiveness: score10,
    })
  ),

  // ─── Trust / credibility inventory ──────────────────────────────────────
  trustSignals: z.array(
    z.object({
      timestamp: z.number(),
      type: z
        .string()
        .describe(
          "testimonial-quote | before-after | expert-credential | ugc-aesthetic | specific-number | time-bound-claim | third-party-citation | user-review | visual-proof | live-demonstration | behind-the-scenes | founder-on-camera"
        ),
      description: z.string(),
      strength: score10,
    })
  ),

  // ─── Emotional arc ──────────────────────────────────────────────────────
  emotionalArc: z.array(
    z.object({
      timestamp: z.number(),
      primary: z.string(),
      intensity: score10,
      note: z.string().optional(),
    })
  ),

  // ─── Micro-moment inventory ─────────────────────────────────────────────
  microMoments: z.array(
    z.object({
      timestamp: z.number(),
      kind: z
        .string()
        .describe(
          "product-reveal | first-product-glimpse | price-mention | proof-beat | social-proof | problem-agitation | solution-intro | benefit-stated | objection-handled | brand-name | logo-exposure | before-state | after-state | cta-lead-in | surprise-twist"
        ),
      description: z.string(),
      impactOnRetention: z.enum([
        "very-positive",
        "positive",
        "neutral",
        "negative",
      ]),
    })
  ),

  // ─── Platform-specific fit ──────────────────────────────────────────────
  platformFit: z.object({
    tiktok: z.object({ score: score10, reasoning: z.string() }),
    reels: z.object({ score: score10, reasoning: z.string() }),
    youtubeShorts: z.object({ score: score10, reasoning: z.string() }),
    bestFit: z.enum(["tiktok", "reels", "youtube-shorts", "all-equal"]),
    notes: z.string(),
  }),
});

export type AnalysisExtended = z.infer<typeof AnalysisExtendedSchema>;
