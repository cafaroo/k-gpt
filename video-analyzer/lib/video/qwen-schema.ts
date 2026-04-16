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
} from "./framework/taxonomy";

// Plain number, no preprocess, no min/max. Google's structured-output engine
// treats z.preprocess and min/max bounds as extra constraint states, and even
// a moderate schema with many such fields hits the "too many states for
// serving" limit. We normalize 0-100 → 0-10 via normalizeScores() after
// generateObject returns.
export const score10 = z.number();

export const QwenAnalysisSchema = z.object({
  // ─── Overall ────────────────────────────────────────────────────────────
  overall: z.object({
    score: z.number().describe("Overall ad quality score 0-100"),
    tagline: z
      .string()
      .describe("One-line summary like 'Strong hook, weak CTA'"),
    summary: z.string().describe("2-3 sentence executive summary"),
  }),

  // ─── Hook (extended with taxonomy) ──────────────────────────────────────
  hook: z.object({
    score: score10,
    duration: z.number().describe("Seconds the hook lasts before main content"),
    primaryStyle: z.enum(HOOK_STYLES).describe("Dominant hook style"),
    secondaryStyles: z
      .array(z.enum(HOOK_STYLES))
      .describe("Additional hook styles present, if any"),
    timeToFirstVisualChange: z
      .number()
      .describe(
        "Seconds until first cut / zoom / B-roll swap / camera move. Lower = stronger hook."
      ),
    textInFirstFrame: z.object({
      present: z.boolean(),
      text: z.string().optional(),
      keywordFirst: z
        .boolean()
        .describe(
          "True if first on-screen text leads with a keyword/benefit (not a vague tease)"
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
        strength: score10,
      })
    )
    .describe(
      "Sequence of story beats. Canonical pattern: hook → micro-proof → how-to → soft-cta"
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
    score: score10,
    cutsPerMinute: z.number(),
    rhythm: z.enum(["slow", "medium", "fast", "erratic"]),
    deadSpots: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        reason: z.string(),
      })
    ),
    intensityCurve: z
      .array(
        z.object({
          time: z.number(),
          intensity: score10,
          note: z.string(),
        })
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
    })
  ),

  // ─── On-screen text (full event list + coverage stats) ──────────────────
  onScreenText: z.object({
    events: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        style: z.string(),
        position: z.string(),
      })
    ),
    coverageRatio: z
      .number()
      .describe("Fraction of runtime with any on-screen text"),
    captionsVsOverlay: z.enum([
      "captions-only",
      "overlay-only",
      "mixed",
      "none",
    ]),
    keywordFirst: z.boolean(),
    claimClarity: z.number().describe("0 = vague tease, 10 = concrete claim"),
    pricesShown: z.array(
      z.object({ value: z.string(), timestamp: z.number() })
    ),
  }),

  // ─── CTA (extended taxonomy) ────────────────────────────────────────────
  cta: z.object({
    exists: z.boolean(),
    type: z.enum(CTA_TYPES),
    text: z.string().optional(),
    clarity: score10,
    timing: z.enum(["start", "middle", "end", "throughout", "none"]),
    askSize: z.enum(CTA_ASK_SIZES),
    nativenessScore: z.number().describe("10 = fully native; 0 = hard sell"),
    microCTAEarly: z
      .boolean()
      .describe("Does an early 'watch till end for…' cue exist?"),
    improvements: z.array(z.string()),
  }),

  // ─── Audio (base — extended fields live in AnalysisExtendedSchema) ──────
  audio: z.object({
    hasVoiceover: z.boolean(),
    hasMusic: z.boolean(),
    voiceoverDensity: z
      .enum(["sparse", "moderate", "dense"])
      .optional()
      .describe("How talk-dense the video is"),
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
    variety: score10,
    dominantColors: z.array(z.string()),
    mood: z.string(),
    textOverlayUsage: z.enum(["none", "minimal", "moderate", "heavy"]),
    shotTypes: z.array(z.enum(SHOT_TYPES)),
    cameraMovement: z.enum(["static", "handheld", "dynamic", "mixed"]),
    dominantFaceRatio: z
      .number()
      .describe("Fraction of frames with a visible human face"),
    brandingVisibility: z.enum(["none", "subtle", "moderate", "heavy"]),
    details: z
      .string()
      .describe(
        "Free-form narrative covering aesthetic, camera angles, transitions, overall style — 2-4 sentences."
      )
      .default(""),
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
    confidence: z.number(),
    playbookCompliance: z.array(
      z.object({
        ruleId: z.string().describe("ID from NICHE_PLAYBOOKS"),
        label: z.string(),
        met: z.boolean(),
        note: z.string(),
      })
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
        score: score10.optional(),
        evidence: z.string().describe("Concrete evidence citing a timestamp"),
      })
    )
    .describe("Score this video against each universal rule"),

  // ─── Performance proxies (extended) ─────────────────────────────────────
  predictedMetrics: z.object({
    completionRate: z.enum(PERFORMANCE_LEVELS),
    engagementRate: z.enum(PERFORMANCE_LEVELS),
    holdTo3sScore: z.number().describe("Predicted % of viewers reaching 3s"),
    saveLikelihood: score10,
    commentLikelihood: score10,
    shareLikelihood: score10,
    rationale: z.string(),
  }),

  // ─── Insights (observations, NOT recommendations) ──────────────────────
  insights: z
    .array(
      z.object({
        area: z.enum([
          "hook",
          "pacing",
          "visual",
          "audio",
          "cta",
          "copy",
          "editing",
          "structure",
          "retention",
        ]),
        observation: z
          .string()
          .describe(
            "Observation — what IS in the video. No advice, no 'you should'."
          ),
        evidence: z
          .string()
          .describe("Concrete timestamp and observable signal"),
        impact: z.enum(["positive", "neutral", "negative"]),
        note: z
          .string()
          .optional()
          .describe(
            "Optional extra context, e.g. why this pattern correlates with retention"
          ),
      })
    )
    .describe("Insights about the video — analysis, not recommendations"),
});

export type QwenAnalysis = z.infer<typeof QwenAnalysisSchema>;

// Combined shape returned by /analyze/api/analyze — base fields plus the
// extended second-pass payload (or an error string if that pass failed).
// Keep this import lazy-style to avoid circular references.
import type { AnalysisExtended } from "./analysis-extended-schema";

export type QwenAnalysisWithExtended = QwenAnalysis & {
  extended?: AnalysisExtended;
  extendedError?: string;
};

/**
 * Post-hoc score normalization. We removed all `.min(0).max(10)` bounds from
 * the schema to stay under Google's "too many states" serving limit, so Gemini
 * sometimes emits 0-100 values for fields the dashboard expects in 0-10.
 * Walk the object and divide any number > 10 by 10 if the key name implies
 * a 0-10 contract (score, strength, intensity, clarity, risk, etc.).
 *
 * `overall.score` is explicitly 0-100 and must be skipped.
 */
const SCORE10_KEYS = new Set([
  "score",
  "strength",
  "intensity",
  "clarity",
  "risk",
  "effectiveness",
  "nativenessScore",
  "claimClarity",
  "holdTo3sScore",
  "saveLikelihood",
  "commentLikelihood",
  "shareLikelihood",
  "variety",
  "tension",
  "stopPower",
  "energy",
]);

// Item-level hydrators. Each one takes a potentially-partial item from Gemini
// and returns a fully-shaped object the dashboard can trust.
function coerceNumberPrimary(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const parsed = Number.parseFloat(v);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

const asNum = (v: unknown, d = 0): number => coerceNumberPrimary(v) ?? d;
const asStr = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const asBool = (v: unknown, d = false): boolean =>
  typeof v === "boolean" ? v : d;
const asArr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const asStrArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : typeof v === "string"
      ? v
          .split(/[,;|]\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

function hydrateBeat(b: unknown): QwenAnalysis["beatMap"][number] {
  const o = (b ?? {}) as Record<string, unknown>;
  return {
    type: asStr(o.type, "other") as QwenAnalysis["beatMap"][number]["type"],
    start: asNum(o.start),
    end: asNum(o.end, asNum(o.start)),
    description: asStr(o.description),
    strength: asNum(o.strength),
  };
}

function hydrateScene(s: unknown): QwenAnalysis["scenes"][number] {
  const o = (s ?? {}) as Record<string, unknown>;
  return {
    start: asNum(o.start),
    end: asNum(o.end, asNum(o.start)),
    label: asStr(o.label),
    function: asStr(
      o.function,
      "other"
    ) as QwenAnalysis["scenes"][number]["function"],
    description: asStr(o.description),
    visualStyle: asStr(o.visualStyle),
    textOnScreen:
      typeof o.textOnScreen === "string" ? o.textOnScreen : undefined,
  };
}

function hydrateIntensity(
  i: unknown
): QwenAnalysis["pacing"]["intensityCurve"][number] {
  const o = (i ?? {}) as Record<string, unknown>;
  return {
    time: asNum(o.time),
    intensity: asNum(o.intensity),
    note: asStr(o.note),
  };
}

function hydrateDeadSpot(
  d: unknown
): QwenAnalysis["pacing"]["deadSpots"][number] {
  const o = (d ?? {}) as Record<string, unknown>;
  return {
    start: asNum(o.start),
    end: asNum(o.end, asNum(o.start)),
    reason: asStr(o.reason),
  };
}

function hydrateTextEvent(
  e: unknown
): QwenAnalysis["onScreenText"]["events"][number] {
  const o = (e ?? {}) as Record<string, unknown>;
  return {
    start: asNum(o.start),
    end: asNum(o.end, asNum(o.start)),
    text: asStr(o.text),
    style: asStr(o.style, "unknown"),
    position: asStr(o.position, "unknown"),
  };
}

function hydratePlaybook(
  p: unknown
): QwenAnalysis["niche"]["playbookCompliance"][number] {
  const o = (p ?? {}) as Record<string, unknown>;
  return {
    ruleId: asStr(o.ruleId),
    label: asStr(o.label),
    met: asBool(o.met),
    note: asStr(o.note),
  };
}

function hydrateRule(r: unknown): QwenAnalysis["ruleCompliance"][number] {
  const o = (r ?? {}) as Record<string, unknown>;
  return {
    ruleId: asStr(o.ruleId),
    title: asStr(o.title),
    met: asBool(o.met),
    score: coerceNumber(o.score) ?? undefined,
    evidence: asStr(o.evidence),
  };
}

function hydratePrice(
  p: unknown
): QwenAnalysis["onScreenText"]["pricesShown"][number] {
  const o = (p ?? {}) as Record<string, unknown>;
  return { value: asStr(o.value), timestamp: asNum(o.timestamp) };
}

function hydrateInsight(r: unknown): QwenAnalysis["insights"][number] {
  const o = (r ?? {}) as Record<string, unknown>;
  const rawArea = asStr(o.area, "copy");
  const validAreas = [
    "hook",
    "pacing",
    "visual",
    "audio",
    "cta",
    "copy",
    "editing",
    "structure",
    "retention",
  ] as const;
  const area = (validAreas as readonly string[]).includes(rawArea)
    ? (rawArea as QwenAnalysis["insights"][number]["area"])
    : "copy";
  const rawImpact = asStr(o.impact, "neutral");
  const impact =
    rawImpact === "positive" || rawImpact === "negative"
      ? rawImpact
      : "neutral";
  return {
    area,
    observation: asStr(o.observation ?? o.issue ?? o.problem),
    evidence: asStr(o.evidence ?? o.suggestion ?? o.rationale),
    impact,
    note: typeof o.note === "string" ? o.note : undefined,
  };
}

/**
 * Fills in every required field the dashboard expects, using defaults when
 * Gemini skipped something. Runs after normalizeScores. Shallow-merges so any
 * field Gemini returned wins over the default, and each nested array item is
 * hydrated to a complete shape (filtering out malformed items isn't enough —
 * dashboards expect numbers, strings, and booleans in specific slots).
 */
export function ensureBaseShape(raw: unknown): QwenAnalysis {
  const r = (raw ?? {}) as Partial<QwenAnalysis> & Record<string, unknown>;
  return {
    overall: {
      score: asNum((r.overall as Record<string, unknown>)?.score),
      tagline: asStr(
        (r.overall as Record<string, unknown>)?.tagline,
        "Analysis incomplete"
      ),
      summary: asStr((r.overall as Record<string, unknown>)?.summary),
    },
    hook: (() => {
      const h = (r.hook ?? {}) as Record<string, unknown>;
      const tif = (h.textInFirstFrame ?? {}) as Record<string, unknown>;
      return {
        score: asNum(h.score),
        duration: asNum(h.duration),
        primaryStyle: asStr(
          h.primaryStyle,
          "result-tease"
        ) as QwenAnalysis["hook"]["primaryStyle"],
        secondaryStyles: asStrArr(
          h.secondaryStyles
        ) as QwenAnalysis["hook"]["secondaryStyles"],
        timeToFirstVisualChange: asNum(h.timeToFirstVisualChange),
        textInFirstFrame: {
          present: asBool(tif.present),
          text: typeof tif.text === "string" ? tif.text : undefined,
          keywordFirst: asBool(tif.keywordFirst),
        },
        elements: asStrArr(h.elements),
        rationale: asStr(h.rationale),
        improvements: asStrArr(h.improvements),
      };
    })(),
    beatMap: asArr(r.beatMap).map(hydrateBeat),
    payoffTiming: {
      firstGlimpseAt: null,
      fullRevealAt: null,
      isEarly: false,
      ...(r.payoffTiming ?? {}),
    },
    pacing: (() => {
      const p = (r.pacing ?? {}) as Record<string, unknown>;
      return {
        score: asNum(p.score),
        cutsPerMinute: asNum(p.cutsPerMinute),
        rhythm: asStr(p.rhythm, "medium") as QwenAnalysis["pacing"]["rhythm"],
        deadSpots: asArr(p.deadSpots).map(hydrateDeadSpot),
        intensityCurve: asArr(p.intensityCurve).map(hydrateIntensity),
      };
    })(),
    scenes: asArr(r.scenes).map(hydrateScene),
    onScreenText: (() => {
      const o = (r.onScreenText ?? {}) as Record<string, unknown>;
      return {
        events: asArr(o.events).map(hydrateTextEvent),
        coverageRatio: asNum(o.coverageRatio),
        captionsVsOverlay: asStr(
          o.captionsVsOverlay,
          "none"
        ) as QwenAnalysis["onScreenText"]["captionsVsOverlay"],
        keywordFirst: asBool(o.keywordFirst),
        claimClarity: asNum(o.claimClarity),
        pricesShown: asArr(o.pricesShown).map(hydratePrice),
      };
    })(),
    cta: (() => {
      const c = (r.cta ?? {}) as Record<string, unknown>;
      return {
        exists: asBool(c.exists),
        type: asStr(c.type, "none") as QwenAnalysis["cta"]["type"],
        text: typeof c.text === "string" ? c.text : undefined,
        clarity: asNum(c.clarity),
        timing: asStr(c.timing, "none") as QwenAnalysis["cta"]["timing"],
        askSize: asStr(c.askSize, "low") as QwenAnalysis["cta"]["askSize"],
        nativenessScore: asNum(c.nativenessScore),
        microCTAEarly: asBool(c.microCTAEarly),
        improvements: asStrArr(c.improvements),
      };
    })(),
    audio: {
      hasVoiceover: false,
      hasMusic: false,
      audioNotes: "",
      ...(r.audio ?? {}),
    } as QwenAnalysis["audio"],
    visual: (() => {
      const v = (r.visual ?? {}) as Record<string, unknown>;
      return {
        variety: asNum(v.variety),
        dominantColors: asStrArr(v.dominantColors),
        mood: asStr(v.mood),
        textOverlayUsage: asStr(
          v.textOverlayUsage,
          "none"
        ) as QwenAnalysis["visual"]["textOverlayUsage"],
        shotTypes: asStrArr(v.shotTypes) as QwenAnalysis["visual"]["shotTypes"],
        cameraMovement: asStr(
          v.cameraMovement,
          "static"
        ) as QwenAnalysis["visual"]["cameraMovement"],
        dominantFaceRatio: asNum(v.dominantFaceRatio),
        brandingVisibility: asStr(
          v.brandingVisibility,
          "none"
        ) as QwenAnalysis["visual"]["brandingVisibility"],
        details: asStr(v.details),
      };
    })(),
    format: {
      primary: "other",
      goalAlignment: "awareness",
      ...(r.format ?? {}),
    } as QwenAnalysis["format"],
    niche: (() => {
      const n = (r.niche ?? {}) as Record<string, unknown>;
      return {
        detected: asStr(
          n.detected,
          "other"
        ) as QwenAnalysis["niche"]["detected"],
        confidence: asNum(n.confidence),
        playbookCompliance: asArr(n.playbookCompliance).map(hydratePlaybook),
      };
    })(),
    targetAudience: (() => {
      const t = (r.targetAudience ?? {}) as Record<string, unknown>;
      return {
        ageRange: asStr(t.ageRange),
        interests: asStrArr(t.interests),
        buyerStage: asStr(t.buyerStage),
      };
    })(),
    ruleCompliance: asArr(r.ruleCompliance).map(hydrateRule),
    predictedMetrics: {
      completionRate: "medium",
      engagementRate: "medium",
      holdTo3sScore: 0,
      saveLikelihood: 0,
      commentLikelihood: 0,
      shareLikelihood: 0,
      rationale: "",
      ...(r.predictedMetrics ?? {}),
    } as QwenAnalysis["predictedMetrics"],
    insights: asArr(r.insights).map(hydrateInsight),
  };
}

// Numeric-coerce fields: the dashboard calls .toFixed on these so they must
// be numbers. Gemini sometimes emits them as strings ("8.5" instead of 8.5).
const NUMERIC_KEYS = new Set<string>([
  ...SCORE10_KEYS,
  "duration",
  "timeToFirstVisualChange",
  "cutsPerMinute",
  "coverageRatio",
  "dominantFaceRatio",
  "confidence",
  "time",
  "timestamp",
  "start",
  "end",
  "second",
  "firstGlimpseAt",
  "fullRevealAt",
  "resolvesAt",
]);

function coerceNumber(v: unknown): number | null {
  return coerceNumberPrimary(v);
}

export function normalizeScores<T>(value: T, parentKey?: string): T {
  if (Array.isArray(value)) {
    return value.map((v) => normalizeScores(v, parentKey)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Preserve overall.score (0-100 by contract).
      if (parentKey === "overall" && k === "score") {
        out[k] = coerceNumber(v) ?? v;
      } else {
        out[k] = normalizeScores(v, k);
      }
    }
    return out as T;
  }
  if (parentKey && NUMERIC_KEYS.has(parentKey)) {
    const num = coerceNumber(value);
    if (num !== null) {
      if (SCORE10_KEYS.has(parentKey) && num > 10) {
        return (num / 10) as unknown as T;
      }
      return num as unknown as T;
    }
  }
  if (
    typeof value === "number" &&
    parentKey &&
    SCORE10_KEYS.has(parentKey) &&
    value > 10
  ) {
    return (value / 10) as unknown as T;
  }
  return value;
}
