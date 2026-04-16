/**
 * Gemini doesn't honor our Zod schema field names — it invents its own
 * "natural" structure (overallScore, audioSummary, visualLanguage, etc.).
 * These adapters translate Gemini's output → our QwenAnalysis / extended
 * shape so the dashboard sees what it expects.
 *
 * Each unknown-typed field is defended; raw Gemini output is treated as
 * untrusted JSON. Anything we can't translate falls back to undefined and
 * lets ensureBaseShape() supply a default.
 */

type Any = any;

function asObj(v: unknown): Record<string, Any> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, Any>)
    : {};
}
function asArr(v: unknown): Any[] {
  return Array.isArray(v) ? v : [];
}
function asStr(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d;
}
function asNum(v: unknown, d = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return d;
}

/** Coerce milliseconds → seconds when key obviously means ms. */
function maybeMs(v: unknown, key?: string): number {
  const n = asNum(v);
  if (key && /Ms$|_ms$|Millis(econds)?/i.test(key)) {
    return n / 1000;
  }
  return n;
}

/**
 * Parses Gemini's many timestamp shapes to seconds:
 *   "0:14" → 14
 *   "1:09" → 69
 *   "00:00:20.060" → 20.06
 *   "00:01:14" → 74
 *   14 → 14
 *   "14.5" → 14.5
 */
export function parseTimestamp(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v !== "string") {
    return 0;
  }
  const s = v.trim();
  // h:mm:ss.fff or mm:ss.fff
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number.parseFloat(p));
    if (parts.some((n) => !Number.isFinite(n))) {
      return 0;
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** "0:00-0:03" → { start: 0, end: 3 }, "0:14" → { start: 14, end: 14 }. */
export function parseRange(v: unknown): { start: number; end: number } {
  if (typeof v !== "string") {
    return { start: 0, end: 0 };
  }
  const parts = v.split(/[\u2010-\u2015–—-]/).map((s) => s.trim());
  const start = parseTimestamp(parts[0]);
  const end = parts.length > 1 ? parseTimestamp(parts[1]) : start;
  return { start, end };
}

function splitTags(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string") {
    return v
      .split(/[,;|]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const SCENE_FUNCTIONS = new Set([
  "hook",
  "problem",
  "product-intro",
  "social-proof",
  "demo",
  "benefit",
  "cta",
  "transition",
  "other",
]);

function normalizeSceneFunction(v: unknown): string {
  if (typeof v !== "string") {
    return "other";
  }
  const s = v.toLowerCase().replace(/[\s_]/g, "-").trim();
  if (SCENE_FUNCTIONS.has(s)) {
    return s;
  }
  if (/intro|teaser|opening|start|attention/.test(s)) {
    return "hook";
  }
  if (/problem|pain|issue|agitation|objection/.test(s)) {
    return "problem";
  }
  if (/product|feature|reveal|showcase|introduction/.test(s)) {
    return "product-intro";
  }
  if (/testimonial|review|social|proof|ugc/.test(s)) {
    return "social-proof";
  }
  if (/demo|how|step|show|tutorial|usage|apply|apply/.test(s)) {
    return "demo";
  }
  if (/benefit|result|outcome|after|transformation|payoff/.test(s)) {
    return "benefit";
  }
  if (/cta|call-to-action|buy|shop|offer|link|swipe/.test(s)) {
    return "cta";
  }
  if (/transition|bridge|cut/.test(s)) {
    return "transition";
  }
  console.warn(
    `[gemini-adapter] unknown scene.function "${v}" → fallback "other"`
  );
  return "other";
}

const LEVEL_MAP: Record<string, number> = {
  "very-high": 9.5,
  excellent: 9,
  high: 8,
  good: 7,
  moderate: 5,
  medium: 5,
  fair: 4,
  low: 3,
  poor: 2,
  "very-low": 1,
};

function levelToScore(v: unknown, d = 0): number {
  if (typeof v === "number") {
    return v;
  }
  if (typeof v === "string") {
    const k = v.toLowerCase().replace(/\s+/g, "-");
    if (LEVEL_MAP[k] !== undefined) {
      return LEVEL_MAP[k];
    }
    // Match leading level word: "High. Immediate…" → "high"
    const firstWord = v
      .toLowerCase()
      .match(/^(very[\s-]high|very[\s-]low|[a-z]+)/)?.[0]
      ?.replace(/\s+/g, "-");
    if (firstWord && LEVEL_MAP[firstWord] !== undefined) {
      return LEVEL_MAP[firstWord];
    }
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return d;
}

function levelToPerformanceLevel(v: unknown): "low" | "medium" | "high" {
  const s = String(v ?? "").toLowerCase();
  if (
    s === "high" ||
    s === "very-high" ||
    s === "very_high" ||
    s === "excellent" ||
    s === "good"
  ) {
    return "high";
  }
  if (s === "low" || s === "very-low" || s === "very_low" || s === "poor") {
    return "low";
  }
  return "medium";
}

/**
 * Translate base-pass Gemini output → QwenAnalysis-shaped object that
 * ensureBaseShape() can finish hydrating.
 */
export function adaptBase(raw: unknown): Record<string, Any> {
  const r = asObj(raw);

  // overall: Gemini gives `overallScore: 7.5` flat. Multiply to 0-100 if 0-10.
  const overallScoreRaw = r.overallScore ?? r.overall?.score;
  let overallScore = asNum(overallScoreRaw);
  if (overallScore > 0 && overallScore <= 10) {
    overallScore = Math.round(overallScore * 10);
  }
  const overall = {
    score: overallScore,
    tagline: asStr(r.overall?.tagline),
    summary: asStr(r.overall?.summary ?? r.summary ?? r.overall?.explanation),
  };

  // hook: Gemini may give either nested { hook: {...} } or flat hookStyle/Ms.
  const hr = asObj(r.hook);
  const hookStartMs = r.hookStartMs ?? hr.startMs;
  const hookEndMs = r.hookEndMs ?? hr.endMs;
  const hookStart =
    typeof hookStartMs === "undefined"
      ? parseTimestamp(hr.timestamp ?? hr.start)
      : maybeMs(hookStartMs, "Ms");
  const hookEnd =
    typeof hookEndMs === "undefined"
      ? parseTimestamp(hr.endTimestamp ?? hr.end) || hookStart + 3
      : maybeMs(hookEndMs, "Ms");
  const hookText = asStr(r.hookText ?? hr.text ?? hr.textInFirstFrame?.text);
  const hookExplanation = asStr(
    r.hookAnalysis ?? hr.explanation ?? hr.rationale ?? hr.analysis
  );
  const hook = {
    score: asNum(hr.score ?? r.hookScore, 7),
    duration: asNum(hr.duration, hookEnd - hookStart || 3),
    primaryStyle: asStr(
      hr.primaryStyle ?? hr.style ?? r.hookStyle,
      "result-tease"
    ),
    secondaryStyles: splitTags(hr.secondaryStyles ?? hr.styles),
    timeToFirstVisualChange: asNum(hr.timeToFirstVisualChange, hookStart),
    textInFirstFrame: {
      present: Boolean(hr.textInFirstFrame?.present ?? hookText),
      text: hookText || undefined,
      keywordFirst: Boolean(hr.textInFirstFrame?.keywordFirst),
    },
    elements: splitTags(hr.elements ?? r.hookVisual),
    rationale: hookExplanation,
    improvements: splitTags(hr.improvements),
  };

  // beatMap: Gemini emits { startTime:"0:02", endTime:"0:04", type, content }
  // OR { timestamp, type, detail } OR { startMs, endMs, type, text }.
  const rawBeats = asArr(r.beatMap);
  const beatTimes = rawBeats.map((b) => {
    const o = asObj(b);
    if (typeof o.startMs !== "undefined") {
      return maybeMs(o.startMs, "Ms");
    }
    return parseTimestamp(o.start ?? o.startTime ?? o.timestamp);
  });
  const beatMap = rawBeats.map((b, i) => {
    const o = asObj(b);
    const start =
      typeof o.startMs === "undefined"
        ? parseTimestamp(o.start ?? o.startTime ?? o.timestamp)
        : maybeMs(o.startMs, "Ms");
    const next = beatTimes[i + 1];
    const end =
      typeof o.endMs === "undefined"
        ? typeof o.end === "undefined" && typeof o.endTime === "undefined"
          ? (next ?? start + 4)
          : parseTimestamp(o.end ?? o.endTime)
        : maybeMs(o.endMs, "Ms");
    return {
      type: asStr(o.type, "other"),
      start,
      end,
      description: asStr(
        o.description ?? o.detail ?? o.content ?? o.text ?? o.label
      ),
      strength: asNum(o.strength, 7),
    };
  });

  // pacing: object { overall, explanation } OR a plain string paragraph.
  // intensityCurve sometimes lives at top level instead of under pacing.
  const pacingRaw = r.pacing;
  const pr =
    typeof pacingRaw === "string"
      ? { explanation: pacingRaw, overall: "" }
      : asObj(pacingRaw);
  const intensityCurveRaw = asArr(pr.intensityCurve ?? r.intensityCurve);
  const pacing = {
    score: asNum(pr.score, levelToScore(pr.overall, 6)),
    cutsPerMinute: asNum(pr.cutsPerMinute ?? r.cutsPerMinute, 20),
    rhythm: asStr(pr.rhythm ?? pr.overall, "medium"),
    deadSpots: asArr(pr.deadSpots).map((d) => {
      const o = asObj(d);
      const range = parseRange(o.range ?? o.timestamp);
      return {
        start:
          typeof o.startMs === "undefined"
            ? asNum(o.start, range.start)
            : maybeMs(o.startMs, "Ms"),
        end:
          typeof o.endMs === "undefined"
            ? asNum(o.end, range.end)
            : maybeMs(o.endMs, "Ms"),
        reason: asStr(o.reason ?? o.note ?? o.detail),
      };
    }),
    intensityCurve: intensityCurveRaw.map((it) => {
      const o = asObj(it);
      return {
        time:
          typeof o.timeMs === "undefined"
            ? asNum(o.time, parseTimestamp(o.timestamp))
            : maybeMs(o.timeMs, "Ms"),
        intensity: asNum(o.intensity, 5),
        note: asStr(o.note ?? o.label),
      };
    }),
  };

  // scenes: Gemini emits { startTime:"0:01", endTime:"0:02", function,
  //   visualContent, spokenContent } OR { timestamp, description }
  //   OR { startMs, endMs, description }
  const rawScenes = asArr(r.scenes);
  const sceneTimes = rawScenes.map((s) => {
    const o = asObj(s);
    return typeof o.startMs === "undefined"
      ? parseTimestamp(o.start ?? o.startTime ?? o.timestamp)
      : maybeMs(o.startMs, "Ms");
  });
  const scenes = rawScenes.map((s, i) => {
    const o = asObj(s);
    const start =
      typeof o.startMs === "undefined"
        ? parseTimestamp(o.start ?? o.startTime ?? o.timestamp)
        : maybeMs(o.startMs, "Ms");
    const next = sceneTimes[i + 1];
    const end =
      typeof o.endMs === "undefined"
        ? typeof o.end === "undefined" && typeof o.endTime === "undefined"
          ? (next ?? start + 3)
          : parseTimestamp(o.end ?? o.endTime)
        : maybeMs(o.endMs, "Ms");
    const visual = asStr(o.visualContent ?? o.visual ?? o.description);
    const spoken = asStr(o.spokenContent ?? o.spoken ?? o.voiceover);
    const description = [visual, spoken ? `Spoken: "${spoken}"` : ""]
      .filter(Boolean)
      .join(" — ");
    return {
      start,
      end,
      label: asStr(o.label ?? visual ?? o.description).slice(0, 40),
      function: normalizeSceneFunction(o.function ?? o.type ?? o.purpose),
      description: description || asStr(o.description),
      visualStyle: asStr(o.visualStyle ?? o.style),
      textOnScreen: o.textOnScreen ? asStr(o.textOnScreen) : undefined,
    };
  });

  // onScreenText: events[].range "0:00-0:03"
  const ot = asObj(r.onScreenText);
  const onScreenText = {
    events: asArr(ot.events).map((e) => {
      const o = asObj(e);
      const range = parseRange(o.range ?? o.timestamp);
      return {
        start: asNum(o.start, range.start),
        end: asNum(o.end, range.end),
        text: asStr(o.text),
        style: asStr(o.style),
        position: asStr(o.position),
      };
    }),
    coverageRatio: asNum(ot.coverageRatio, ot.hasText ? 0.7 : 0),
    captionsVsOverlay: asStr(ot.captionsVsOverlay, "mixed"),
    keywordFirst: Boolean(ot.keywordFirst),
    claimClarity: asNum(ot.claimClarity, 7),
    pricesShown: asArr(ot.pricesShown).map((p) => {
      const o = asObj(p);
      return { value: asStr(o.value), timestamp: parseTimestamp(o.timestamp) };
    }),
  };

  // cta: { timestamp, type, explanation } OR flat ctaType/ctaStartMs/Ms/Text
  const cr = asObj(r.cta);
  const ctaType = asStr(cr.type ?? r.ctaType);
  const ctaStartMs = r.ctaStartMs ?? cr.startMs;
  const ctaStart =
    typeof ctaStartMs === "undefined"
      ? parseTimestamp(cr.timestamp)
      : maybeMs(ctaStartMs, "Ms");
  const ctaText = asStr(cr.text ?? r.ctaText);
  const cta = {
    exists: Boolean(cr.exists ?? ctaType),
    type: ctaType || "none",
    text: ctaText || undefined,
    clarity: asNum(cr.clarity, 7),
    timing: asStr(cr.timing) || (ctaStart > 0 ? "end" : "none"),
    askSize: asStr(cr.askSize, "medium"),
    nativenessScore: asNum(cr.nativenessScore, 5),
    microCTAEarly: Boolean(cr.microCTAEarly),
    improvements: splitTags(cr.improvements),
  };

  // audio: nested {voiceover{present},music{present}} OR flat
  // voiceoverPresent/voiceoverClarity/musicStartMs/soundEffects
  const ar = asObj(r.audio ?? r.audioSummary);
  const vo = asObj(ar.voiceover);
  const mu = asObj(ar.music);
  const hasVO = Boolean(ar.hasVoiceover ?? vo.present ?? ar.voiceoverPresent);
  const hasMusic = Boolean(
    ar.hasMusic ??
      mu.present ??
      ar.musicPresent ??
      typeof ar.musicStartMs !== "undefined"
  );
  const audio = {
    hasVoiceover: hasVO,
    hasMusic,
    voiceoverDensity:
      asStr(ar.voiceoverDensity ?? vo.energy ?? ar.voiceoverClarity) ||
      undefined,
    voiceoverSummary:
      asStr(ar.voiceoverSummary ?? ar.explanation ?? ar.voiceoverClarity) ||
      undefined,
    musicEnergy: levelToPerformanceLevel(
      ar.musicEnergy ?? mu.level ?? mu.energy
    ),
    audioVisualSync: asStr(ar.audioVisualSync ?? mu.match) || undefined,
    audioNotes: asStr(
      ar.audioNotes ?? ar.explanation ?? ar.soundEffects ?? ar.musicDescription
    ),
  };

  // visual: { style, details } OR { aesthetic(s), cameraAngles/cameraWork,
  //   transitions, overallStyle, ... }. Gemini returns rich narrative prose in
  //   aesthetic/cameraAngles/transitions/overallStyle — merge them into
  //   `details` so the dashboard can show a meaningful description.
  const vr = asObj(r.visual ?? r.visualLanguage);
  const visualMood = asStr(
    vr.mood ?? vr.style ?? vr.aesthetic ?? vr.aesthetics
  );
  const narrativeParts = [
    asStr(vr.aesthetic ?? vr.aesthetics),
    asStr(vr.cameraAngles ?? vr.cameraWork ?? vr.composition),
    asStr(vr.transitions),
    asStr(vr.overallStyle ?? vr.style),
    asStr(vr.details),
  ].filter(Boolean);
  // Dedupe — mood often equals aesthetic, don't repeat.
  const visualDetails = Array.from(new Set(narrativeParts)).join(" ");
  const visual = {
    variety: asNum(vr.variety, 7),
    dominantColors: splitTags(vr.dominantColors ?? vr.colorPalette),
    mood: visualMood,
    textOverlayUsage: asStr(
      vr.textOverlayUsage,
      onScreenText.events.length > 5 ? "heavy" : "moderate"
    ),
    shotTypes: splitTags(vr.shotTypes ?? vr.cameraWork),
    cameraMovement: asStr(vr.cameraMovement, "mixed"),
    dominantFaceRatio: asNum(vr.dominantFaceRatio, 0.5),
    brandingVisibility: asStr(vr.brandingVisibility, "moderate"),
    details: visualDetails,
  };

  // format / niche: Gemini sometimes returns plain strings
  const format =
    typeof r.format === "string"
      ? { primary: r.format, goalAlignment: "consideration" }
      : {
          primary: asStr(asObj(r.format).primary, "other"),
          secondary: asObj(r.format).secondary
            ? asStr(asObj(r.format).secondary)
            : undefined,
          goalAlignment: asStr(asObj(r.format).goalAlignment, "consideration"),
        };
  const niche =
    typeof r.niche === "string"
      ? { detected: r.niche, confidence: 0.8, playbookCompliance: [] }
      : {
          detected: asStr(asObj(r.niche).detected, "other"),
          confidence: asNum(asObj(r.niche).confidence, 0.7),
          playbookCompliance: asArr(asObj(r.niche).playbookCompliance).map(
            (p) => {
              const o = asObj(p);
              return {
                ruleId: asStr(o.ruleId ?? o.rule ?? o.id),
                label: asStr(o.label ?? o.title ?? o.rule),
                met: Boolean(o.met),
                note: asStr(o.note ?? o.evidence),
              };
            }
          ),
        };

  // targetAudience: { demographics, psychographics } OR { primary, secondary }
  const tr = asObj(r.targetAudience);
  const taPrimary = asStr(tr.demographics ?? tr.primary);
  const taSecondary = asStr(tr.psychographics ?? tr.secondary);
  const targetAudience = {
    ageRange: asStr(tr.ageRange) || taPrimary,
    interests: splitTags(tr.interests ?? taSecondary),
    buyerStage: asStr(tr.buyerStage ?? tr.stage),
  };

  // ruleCompliance: [{ rule, met, timestamp, evidence }]
  const ruleCompliance = asArr(r.ruleCompliance).map((rc) => {
    const o = asObj(rc);
    return {
      ruleId: asStr(o.ruleId ?? o.rule ?? o.id),
      title: asStr(o.title ?? o.rule ?? o.label),
      met: Boolean(o.met),
      score: typeof o.score === "undefined" ? undefined : asNum(o.score),
      evidence: asStr(o.evidence ?? o.note),
    };
  });

  // predictedMetrics: { hookRate: { score, explanation }, retentionRate: ... }
  const pmr = asObj(r.predictedMetrics);
  const hookRate = asObj(pmr.hookRate);
  const retentionRate = asObj(pmr.retentionRate);
  const engagementRate = asObj(pmr.engagementRate ?? pmr.engagement);
  const completionRate = asObj(pmr.completionRate ?? pmr.completion);
  const saveRate = asObj(pmr.saveLikelihood ?? pmr.saveRate);
  const commentRate = asObj(pmr.commentLikelihood ?? pmr.commentRate);
  const shareRate = asObj(pmr.shareLikelihood ?? pmr.shareRate);
  const predictedMetrics = {
    completionRate: levelToPerformanceLevel(
      pmr.completionRate ?? completionRate.score ?? retentionRate.score
    ),
    engagementRate: levelToPerformanceLevel(
      pmr.engagementRate ?? engagementRate.score
    ),
    holdTo3sScore: levelToScore(pmr.holdTo3sScore ?? hookRate.score, 7),
    saveLikelihood: levelToScore(pmr.saveLikelihood ?? saveRate.score, 5),
    commentLikelihood: levelToScore(
      pmr.commentLikelihood ?? commentRate.score,
      5
    ),
    shareLikelihood: levelToScore(pmr.shareLikelihood ?? shareRate.score, 5),
    rationale: asStr(
      pmr.rationale ?? retentionRate.explanation ?? hookRate.explanation
    ),
  };

  // insights: observations. Fall back to legacy recommendations if Gemini
  // still emits that shape (older prompt, cached run, etc.).
  const rawInsights = asArr(r.insights);
  if (rawInsights.length === 0 && asArr(r.recommendations).length > 0) {
    console.warn(
      "[gemini-adapter] no insights[] in response, falling back to recommendations[]"
    );
  }
  const sourceInsights =
    rawInsights.length > 0 ? rawInsights : asArr(r.recommendations);
  const insights = sourceInsights.map((rec) => {
    const o = asObj(rec);
    const rawImpact = asStr(o.impact).toLowerCase();
    const impact =
      rawImpact === "positive" || rawImpact === "negative"
        ? rawImpact
        : "neutral";
    return {
      area: asStr(o.area, "copy"),
      observation: asStr(o.observation ?? o.issue ?? o.problem),
      evidence: asStr(o.evidence ?? o.suggestion ?? o.rationale ?? o.note),
      impact,
      note: typeof o.note === "string" ? o.note : undefined,
    };
  });

  // payoffTiming: not provided by Gemini — synthesize from beatMap
  const payoffBeat = beatMap.find((b) => /payoff|reveal/i.test(b.type));
  const payoffTiming = {
    firstGlimpseAt: payoffBeat ? payoffBeat.start : null,
    fullRevealAt: payoffBeat ? payoffBeat.end : null,
    isEarly: payoffBeat
      ? payoffBeat.start < (asNum(beatMap.at(-1)?.end, 60) || 60) * 0.3
      : false,
  };

  return {
    overall,
    hook,
    beatMap,
    payoffTiming,
    pacing,
    scenes,
    onScreenText,
    cta,
    audio,
    visual,
    format,
    niche,
    targetAudience,
    ruleCompliance,
    predictedMetrics,
    insights,
  };
}

/**
 * Translate extended-pass output. Mostly field-renaming + timestamp parsing.
 */
export function adaptExtended(raw: unknown): Record<string, Any> {
  const r = asObj(raw);

  // transcript: { languageCode, segments[start: "00:00:00.040" string] }
  const tr = asObj(r.transcript);
  const transcript = {
    language: asStr(tr.language ?? tr.languageCode, "en"),
    segments: asArr(tr.segments).map((s) => {
      const o = asObj(s);
      return {
        start: parseTimestamp(o.start),
        end: parseTimestamp(o.end),
        text: asStr(o.text),
        speaker: asStr(o.speaker) || undefined,
      };
    }),
    fullText: asStr(
      tr.fullText ??
        asArr(tr.segments)
          .map((s) => asStr(asObj(s).text))
          .join(" ")
    ),
  };

  // audioExtended: voiceoverTone is comma-separated string from Gemini
  const ar = asObj(r.audioExtended);
  const music = asObj(ar.music);
  const audioExtended = {
    voiceoverTone: splitTags(ar.voiceoverTone),
    voiceoverPace: asStr(ar.voiceoverPace) || undefined,
    music: {
      present: Boolean(music.present ?? music.genre),
      genre: asStr(music.genre) || undefined,
      mood: asStr(music.mood) || undefined,
      energyCurve: (() => {
        const raw = asArr(music.energyCurve).map((e) => {
          const o = asObj(e);
          return {
            time: asNum(o.time, parseTimestamp(o.timestamp)),
            energy: asNum(o.energy, 5),
          };
        });
        // Gemini emits energy on a 0-1 scale even though the schema asks for
        // 0-10. If every sample sits at or below 1.0, rescale to 0-10 so the
        // chart renders visible peaks instead of a flat line at the baseline.
        const max = raw.reduce((m, p) => Math.max(m, p.energy), 0);
        if (max > 0 && max <= 1) {
          return raw.map((p) => ({ ...p, energy: p.energy * 10 }));
        }
        return raw;
      })(),
      beatSync: asStr(music.beatSync) || undefined,
      drops: asArr(music.drops).map((d) => {
        const o = asObj(d);
        return {
          timestamp: parseTimestamp(o.timestamp ?? o.time),
          effect: asStr(o.effect ?? o.description),
        };
      }),
    },
    ambientSounds: asArr(ar.ambientSounds).map((a) => {
      const o = asObj(a);
      const range = parseRange(o.range ?? o.timestamp);
      return {
        start: asNum(o.start, range.start),
        end: asNum(o.end, range.end),
        description: asStr(o.description ?? o.note),
        role: asStr(o.role, "atmosphere"),
      };
    }),
    soundEffects: asArr(ar.soundEffects).map((s) => {
      const o = asObj(s);
      return {
        timestamp: parseTimestamp(o.timestamp ?? o.time),
        sfx: asStr(o.sfx ?? o.effect ?? o.description),
        purpose: asStr(o.purpose ?? o.note),
      };
    }),
    silenceMoments: asArr(ar.silenceMoments).map((s) => {
      const o = asObj(s);
      const range = parseRange(o.range ?? o.timestamp);
      return {
        start: asNum(o.start, range.start),
        end: asNum(o.end, range.end),
        impact: asStr(o.impact ?? o.note),
      };
    }),
    audioDensity: asStr(ar.audioDensity, "moderate"),
  };

  // hookDissection: Gemini returns { "0": {...}, "1": {...}, … } where each
  // entry has { visual, audio, text, tension: "High. …", curiosityGap,
  // stopPowerScore }. Older shape uses "0s"/"1s" keys or a firstSecond object.
  const hd = asObj(r.hookDissection);
  const secondEntry = (i: number): Record<string, unknown> =>
    asObj(hd[`${i}s`] ?? hd[String(i)] ?? (i === 0 ? hd.firstSecond : {}));
  const perSecond = [0, 1, 2, 3].map((i) => {
    const o = secondEntry(i);
    return {
      second: i,
      visual: asStr(o.visual ?? o.visualDescription),
      audio: asStr(o.audio ?? o.audioEvent),
      text: asStr(o.text ?? o.textOnScreen) || undefined,
      tension: levelToScore(o.tension, 5),
    };
  });
  const firstSecond = secondEntry(0);
  // curiosityGap + stopPower: accept both top-level and nested-in-firstSecond
  const topGap = asObj(hd.curiosityGap);
  const nestedGap = asObj(firstSecond.curiosityGap);
  const gap = Object.keys(topGap).length > 0 ? topGap : nestedGap;
  const gapResolvedAt = gap.resolvesAt ?? gap.resolvedAt;
  const stopPowerRaw =
    hd.stopPower ?? hd.stopPowerScore ?? firstSecond.stopPowerScore;
  const hookDissection = {
    firstSecond: {
      visualDescription: asStr(
        firstSecond.visualDescription ?? firstSecond.visual
      ),
      audioEvent: asStr(firstSecond.audioEvent ?? firstSecond.audio),
      textOnScreen:
        asStr(firstSecond.textOnScreen ?? firstSecond.text) || undefined,
      attentionTriggers: splitTags(firstSecond.attentionTriggers),
      promiseEstablished: asStr(
        firstSecond.promiseEstablished ?? firstSecond.tension
      ),
    },
    firstThreeSeconds: perSecond,
    curiosityGap: {
      present: Boolean(gap.present ?? hd.curiosityGap),
      description: asStr(gap.description),
      resolvesAt:
        typeof gapResolvedAt === "undefined" || gapResolvedAt === null
          ? null
          : parseTimestamp(gapResolvedAt),
    },
    stopPower: asNum(stopPowerRaw, 7),
  };

  // swipeRiskCurve: matches mostly already
  const swipeRiskCurve = asArr(r.swipeRiskCurve).map((s) => {
    const o = asObj(s);
    return {
      second: asNum(o.second, parseTimestamp(o.time ?? o.timestamp)),
      risk: asNum(o.risk, 3),
      reason: asStr(o.reason),
    };
  });

  // patternInterrupts: { time, type, effectiveness, note }
  const patternInterrupts = asArr(r.patternInterrupts).map((p) => {
    const o = asObj(p);
    return {
      timestamp: parseTimestamp(o.timestamp ?? o.time),
      type: asStr(o.type, "visual-cut"),
      description: asStr(o.description ?? o.note),
      effectiveness: asNum(o.effectiveness, 6),
    };
  });

  // trustSignals: { time, type, strength, note }
  const trustSignals = asArr(r.trustSignals).map((t) => {
    const o = asObj(t);
    return {
      timestamp: parseTimestamp(o.timestamp ?? o.time),
      type: asStr(o.type, "visual-proof"),
      description: asStr(o.description ?? o.note),
      strength: asNum(o.strength, 5),
    };
  });

  // emotionalArc: { time, emotion, intensity, note }
  const emotionalArc = asArr(r.emotionalArc).map((e) => {
    const o = asObj(e);
    return {
      timestamp: asNum(o.timestamp, parseTimestamp(o.time)),
      primary: asStr(o.primary ?? o.emotion),
      intensity: asNum(o.intensity, 5),
      note: asStr(o.note) || undefined,
    };
  });

  // microMoments: { time, type, retentionImpact, note }
  const microMoments = asArr(r.microMoments).map((m) => {
    const o = asObj(m);
    return {
      timestamp: parseTimestamp(o.timestamp ?? o.time),
      kind: asStr(o.kind ?? o.type, "proof-beat"),
      description: asStr(o.description ?? o.note),
      impactOnRetention: asStr(
        o.impactOnRetention ?? o.retentionImpact,
        "neutral"
      ),
    };
  });

  // platformFit: TitleCase keys → camelCase + structured score
  const pf = asObj(r.platformFit);
  const platformScore = (key: string, ...alts: string[]): number => {
    for (const k of [key, ...alts]) {
      const v = pf[k];
      if (typeof v === "number") {
        return v;
      }
      if (typeof v === "object" && v !== null && "score" in v) {
        return asNum((v as Record<string, unknown>).score, 6);
      }
    }
    return 6;
  };
  const platformReason = (key: string, ...alts: string[]): string => {
    for (const k of [key, ...alts]) {
      const v = pf[k];
      if (typeof v === "object" && v !== null && "reasoning" in v) {
        return asStr((v as Record<string, unknown>).reasoning);
      }
    }
    return "";
  };
  const platformFit = {
    tiktok: {
      score: platformScore("tiktok", "TikTok"),
      reasoning: platformReason("tiktok", "TikTok") || asStr(pf.notes),
    },
    reels: {
      score: platformScore("reels", "Reels", "instagramReels"),
      reasoning: platformReason("reels", "Reels"),
    },
    youtubeShorts: {
      score: platformScore("youtubeShorts", "YouTube Shorts", "youtube_shorts"),
      reasoning: platformReason("youtubeShorts", "YouTube Shorts"),
    },
    bestFit: asStr(pf.bestFit, "tiktok").toLowerCase().replace(/\s+/g, "-"),
    notes: asStr(pf.notes),
  };

  return {
    transcript,
    audioExtended,
    hookDissection,
    swipeRiskCurve,
    patternInterrupts,
    trustSignals,
    emotionalArc,
    microMoments,
    platformFit,
  };
}
