import { z } from "zod";

export const MUSIC_GENRES = [
  "pop",
  "hip-hop",
  "rnb",
  "electronic",
  "edm",
  "lofi",
  "ambient",
  "rock",
  "indie",
  "folk",
  "country",
  "classical",
  "jazz",
  "cinematic-score",
  "trap",
  "house",
  "techno",
  "trailer",
  "corporate",
  "acoustic",
  "world",
  "none",
  "other",
] as const;

export const MUSIC_MOODS = [
  "energetic",
  "uplifting",
  "happy",
  "chill",
  "calm",
  "dark",
  "tense",
  "sad",
  "romantic",
  "dramatic",
  "epic",
  "playful",
  "aggressive",
  "mysterious",
  "nostalgic",
  "none",
] as const;

export const VOICE_TONES = [
  "excited",
  "calm",
  "authoritative",
  "friendly",
  "conversational",
  "urgent",
  "sarcastic",
  "humorous",
  "serious",
  "intimate",
  "monotone",
  "enthusiastic",
  "whisper",
  "shouting",
  "none",
] as const;

export const SPEECH_PACES = [
  "very-slow",
  "slow",
  "normal",
  "fast",
  "very-fast",
] as const;

export const SENTIMENTS = [
  "very-negative",
  "negative",
  "neutral",
  "positive",
  "very-positive",
  "mixed",
] as const;

export const AUDIO_EVENT_TYPES = [
  "music-change",
  "music-drop",
  "silence",
  "voiceover-start",
  "voiceover-end",
  "laugh",
  "applause",
  "cheer",
  "sfx", // generic sound effect
  "whoosh", // transition sfx
  "ding", // notification-style sfx
  "bass-hit",
  "click",
  "breath",
  "typing",
  "ambient-noise",
  "other",
] as const;

export const AudioAnalysisSchema = z.object({
  summary: z
    .string()
    .describe("2-3 sentence executive summary of the audio landscape"),

  music: z.object({
    present: z.boolean(),
    genre: z.enum(MUSIC_GENRES),
    mood: z.enum(MUSIC_MOODS),
    energy: z.number().min(0).max(10).describe("Overall music energy 0-10"),
    tempo: z
      .enum(["very-slow", "slow", "moderate", "fast", "very-fast"])
      .optional(),
    bpmEstimate: z
      .number()
      .nullable()
      .describe("Best-guess BPM if discernible, else null"),
    vocalsInMusic: z
      .boolean()
      .describe("Does the music track have vocals (lyrics)?"),
    isOriginal: z
      .boolean()
      .nullable()
      .describe("Likely original/custom vs trending/commercial track"),
    trendingSoundLikely: z
      .boolean()
      .describe(
        "Sounds like a recognizable trending TikTok/Reels audio (trust your best guess)"
      ),
    descriptors: z
      .array(z.string())
      .describe(
        "Free-form descriptors like 'punchy 808 bass', 'lofi piano', 'epic trailer hits'"
      ),
    notes: z.string(),
  }),

  voiceover: z.object({
    present: z.boolean(),
    speakerCount: z.number().int().min(0),
    gender: z
      .enum(["male", "female", "mixed", "ambiguous", "unknown"])
      .optional(),
    estimatedAgeRange: z.string().optional(),
    tone: z.enum(VOICE_TONES),
    pace: z.enum(SPEECH_PACES),
    clarity: z
      .number()
      .min(0)
      .max(10)
      .describe("How clearly the voiceover is mixed against music/bg"),
    articulation: z
      .number()
      .min(0)
      .max(10)
      .describe("Diction quality of the speaker(s)"),
    accent: z
      .string()
      .optional()
      .describe("e.g. 'neutral American', 'British'"),
    emotionArc: z
      .array(
        z.object({
          start: z.number(),
          end: z.number(),
          emotion: z.string(),
        })
      )
      .describe("How the VO emotion changes over time"),
    transcript: z
      .string()
      .describe("Full transcript of voiceover, if any. Empty if no VO."),
    keyQuotes: z
      .array(
        z.object({
          time: z.number(),
          text: z.string(),
          why: z
            .string()
            .describe("Why this quote matters (hook, claim, cta, etc.)"),
        })
      )
      .describe("Standout lines with timestamps"),
  }),

  sentiment: z.object({
    overall: z.enum(SENTIMENTS),
    arc: z
      .array(
        z.object({
          time: z.number(),
          sentiment: z.enum(SENTIMENTS),
          note: z.string(),
        })
      )
      .describe("Sentiment sampled every 2-3 seconds for plotting"),
    tensionPoints: z
      .array(
        z.object({
          time: z.number(),
          description: z.string(),
        })
      )
      .describe("Moments of peak emotional intensity"),
  }),

  events: z
    .array(
      z.object({
        time: z.number(),
        type: z.enum(AUDIO_EVENT_TYPES),
        description: z.string(),
      })
    )
    .describe("Notable audio events (sfx, laughs, drops, silences, etc.)"),

  soundDesign: z.object({
    sfxCount: z.number().int(),
    usesTransitionSfx: z
      .boolean()
      .describe("Whooshes/clicks between cuts to aid pacing"),
    usesEmphasisSfx: z.boolean().describe("Boom/hit/ding to punctuate beats"),
    silenceUsedIntentionally: z
      .boolean()
      .describe("Deliberate silence for emphasis"),
    audioVisualSync: z.enum(["tight", "loose", "mismatched"]),
    mixQuality: z
      .number()
      .min(0)
      .max(10)
      .describe("Professional mix quality 0-10"),
    notes: z.string(),
  }),

  adSuitability: z.object({
    hookAudioStrength: z
      .number()
      .min(0)
      .max(10)
      .describe("How well the first 2s of audio grabs attention"),
    retentionAidScore: z
      .number()
      .min(0)
      .max(10)
      .describe("Does the audio design keep people watching?"),
    mobileFirstFriendly: z
      .boolean()
      .describe("Would this sound good without headphones on a phone?"),
    captionsRecommended: z
      .boolean()
      .describe("Is captions+VO strongly advised given the mix?"),
    issues: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
});

export type AudioAnalysis = z.infer<typeof AudioAnalysisSchema>;
