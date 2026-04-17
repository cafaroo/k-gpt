/**
 * V2-aware wrappers around v1's Gemini adapters.
 *
 * The v1 adapters (`adaptBase`, `adaptExtended`) only know about v1 fields.
 * When v2's Gemini response includes research fields (colloquialityScore,
 * authenticityBand, etc.) they fall on the floor. These wrappers call the
 * v1 adapter, then merge v2 fields back in from the raw payload.
 */

import { adaptBase, adaptExtended } from "@/lib/video/gemini-adapter";

type Rec = Record<string, unknown>;

function asObj(v: unknown): Rec {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function asEnum<T extends string>(
  v: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof v !== "string") {
    return null;
  }
  const normalized = v.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const match = allowed.find((a) => a.toLowerCase() === normalized);
  return match ?? null;
}

export function adaptBaseV2(raw: unknown): Rec {
  const base = adaptBase(raw);
  const r = asObj(raw);
  const rawPacing = asObj(r.pacing);
  const basePacing = asObj(base.pacing);

  // sceneComplexity was prompted on pacing.sceneComplexity; preserve.
  const sceneComplexity = Array.isArray(rawPacing.sceneComplexity)
    ? rawPacing.sceneComplexity
        .map((s) => {
          const o = asObj(s);
          const start = asNum(o.start);
          const complexity = asNum(o.complexity);
          return start !== null && complexity !== null
            ? { start, complexity }
            : null;
        })
        .filter((x): x is { start: number; complexity: number } => x !== null)
    : [];

  // Batch 4: audienceProfile (base pass)
  const rawAP = asObj(r.audienceProfile);
  const audienceProfile = {
    primaryAgeRange: typeof rawAP.primaryAgeRange === "string" ? rawAP.primaryAgeRange : "",
    primaryGender: asEnum(rawAP.primaryGender, [
      "male", "female", "balanced", "other",
    ] as const) ?? "balanced",
    socioeconomic: asEnum(rawAP.socioeconomic, [
      "budget", "mainstream", "aspirational", "premium", "luxury",
    ] as const) ?? "mainstream",
    urbanicity: asEnum(rawAP.urbanicity, [
      "urban", "suburban", "rural", "mixed",
    ] as const) ?? "mixed",
    region: typeof rawAP.region === "string" ? rawAP.region : undefined,
    lifestyleMarkers: Array.isArray(rawAP.lifestyleMarkers)
      ? rawAP.lifestyleMarkers.filter((x): x is string => typeof x === "string")
      : [],
    values: Array.isArray(rawAP.values)
      ? rawAP.values.filter((x): x is string => typeof x === "string")
      : [],
    pains: Array.isArray(rawAP.pains)
      ? rawAP.pains.filter((x): x is string => typeof x === "string")
      : [],
    desires: Array.isArray(rawAP.desires)
      ? rawAP.desires.filter((x): x is string => typeof x === "string")
      : [],
    purchaseReadiness: asEnum(rawAP.purchaseReadiness, [
      "awareness", "consideration", "decision", "retention",
    ] as const) ?? "awareness",
  };

  return {
    ...base,
    pacing: {
      ...basePacing,
      sceneComplexity,
    },
    audienceProfile,
  };
}

export function adaptExtendedV2(raw: unknown): Rec {
  const extended = adaptExtended(raw);
  const r = asObj(raw);
  const rawAudio = asObj(r.audioExtended);
  const rawHook = asObj(r.hookDissection);
  const extAudio = asObj(extended.audioExtended);
  const extHook = asObj(extended.hookDissection);
  const extArc = Array.isArray(extended.emotionalArc)
    ? extended.emotionalArc
    : [];
  const rawArc = Array.isArray(r.emotionalArc) ? r.emotionalArc : [];

  const voiceoverCadence = asNum(rawAudio.voiceoverCadence);
  const hookColloq = asNum(rawHook.colloquialityScore);
  const videoColloq = asNum(r.colloquialityScore);

  // Merge transitionFromPrevious from raw arc onto adapted arc items by index.
  const mergedArc = extArc.map((item, idx) => {
    const rawItem = asObj(rawArc[idx]);
    const transition = asEnum(rawItem.transitionFromPrevious, [
      "smooth",
      "hard-cut",
      "escalation",
      "release",
    ] as const);
    return transition ? { ...asObj(item), transitionFromPrevious: transition } : item;
  });

  // ── Batch 4: eyeContact ─────────────────────────────────────────────────
  const rawEC = asObj(r.eyeContact);
  const eyeContact = {
    overallScore: asNum(rawEC.overallScore) ?? 0,
    directAddressPct: asNum(rawEC.directAddressPct) ?? 0,
    perScene: Array.isArray(rawEC.perScene)
      ? rawEC.perScene
          .map((s) => {
            const o = asObj(s);
            const start = asNum(o.start);
            const end = asNum(o.end);
            const pct = asNum(o.pct);
            return start !== null && end !== null && pct !== null
              ? { start, end, pct }
              : null;
          })
          .filter(
            (x): x is { start: number; end: number; pct: number } =>
              x !== null
          )
      : [],
  };

  // ── Batch 4: cutsMap ────────────────────────────────────────────────────
  const CUT_TYPES = [
    "hard-cut", "jump-cut", "match-cut", "dissolve", "cross-dissolve",
    "fade-in", "fade-out", "wipe", "whip-pan", "zoom-cut", "other",
  ] as const;
  const cutsMap = Array.isArray(r.cutsMap)
    ? r.cutsMap
        .map((c) => {
          const o = asObj(c);
          const timestamp = asNum(o.timestamp);
          const type = asEnum(o.type, CUT_TYPES);
          if (timestamp === null || !type) return null;
          return {
            timestamp,
            type,
            beforeShot: typeof o.beforeShot === "string" ? o.beforeShot : "",
            afterShot: typeof o.afterShot === "string" ? o.afterShot : "",
            intent: typeof o.intent === "string" ? o.intent : undefined,
          };
        })
        .filter(Boolean)
    : [];

  // ── Batch 4: peopleAnalysis ─────────────────────────────────────────────
  const ROLES = [
    "presenter", "ugc-creator", "testimonial", "expert",
    "actor-silent", "crowd", "voiceover-only", "other",
  ] as const;
  const GENDERS = ["male", "female", "non-binary", "unclear"] as const;
  const AGE_RANGES = [
    "child", "teen", "18-24", "25-34", "35-44",
    "45-54", "55-64", "65+", "unclear",
  ] as const;
  const CAM_TREATMENTS = [
    "close-up-heavy", "medium", "wide", "mixed",
  ] as const;

  const rawPA = asObj(r.peopleAnalysis);
  const rawGM = asObj(rawPA.overallGenderMix);
  const peopleAnalysis = {
    countMax: asNum(rawPA.countMax) ?? 0,
    countAvg: asNum(rawPA.countAvg) ?? 0,
    overallGenderMix: {
      male: asNum(rawGM.male) ?? 0,
      female: asNum(rawGM.female) ?? 0,
      other: asNum(rawGM.other) ?? 0,
    },
    actors: Array.isArray(rawPA.actors)
      ? rawPA.actors
          .map((a) => {
            const o = asObj(a);
            return {
              id: typeof o.id === "string" ? o.id : "A?",
              role: asEnum(o.role, ROLES) ?? "other",
              gender: asEnum(o.gender, GENDERS) ?? "unclear",
              ageRange: asEnum(o.ageRange, AGE_RANGES) ?? "unclear",
              ethnicity:
                typeof o.ethnicity === "string" ? o.ethnicity : undefined,
              styleDescription:
                typeof o.styleDescription === "string"
                  ? o.styleDescription
                  : "",
              appearanceTimeRanges: Array.isArray(o.appearanceTimeRanges)
                ? o.appearanceTimeRanges
                    .map((t) => {
                      const to = asObj(t);
                      const start = asNum(to.start);
                      const end = asNum(to.end);
                      return start !== null && end !== null
                        ? { start, end }
                        : null;
                    })
                    .filter(
                      (x): x is { start: number; end: number } => x !== null
                    )
                : [],
              screenTimePct: asNum(o.screenTimePct) ?? 0,
              energyLevel: asNum(o.energyLevel) ?? 5,
              trustworthiness: asNum(o.trustworthiness) ?? 5,
              eyeContactShare: asNum(o.eyeContactShare) ?? 0,
              cameraTreatment: asEnum(o.cameraTreatment, CAM_TREATMENTS) ?? "mixed",
            };
          })
      : [],
  };

  // ── Batch 4: scriptAngle ────────────────────────────────────────────────
  const ANGLES = [
    "problem-solution", "before-after", "listicle", "testimonial",
    "tutorial", "challenge", "contrarian", "storytime", "ugc-reaction",
    "comparison", "mythbust", "curiosity-tease", "day-in-the-life",
    "expert-explainer", "other",
  ] as const;
  const NARRATIVE_STYLES = [
    "first-person", "second-person", "third-person",
    "dialogue", "monologue", "narration",
  ] as const;
  const HOOK_TYPES = [
    "stat-drop", "question", "bold-claim", "visual-reveal", "contrarian",
    "pattern-interrupt", "emotional-hook", "story-tease", "other",
  ] as const;

  const rawSA = asObj(r.scriptAngle);
  const scriptAngle = {
    angle: asEnum(rawSA.angle, ANGLES) ?? "other",
    narrativeStyle: asEnum(rawSA.narrativeStyle, NARRATIVE_STYLES) ?? "narration",
    hookType: asEnum(rawSA.hookType, HOOK_TYPES) ?? "other",
    thesis: typeof rawSA.thesis === "string" ? rawSA.thesis : "",
    acts: Array.isArray(rawSA.acts)
      ? rawSA.acts
          .map((a) => {
            const o = asObj(a);
            const start = asNum(o.start);
            const end = asNum(o.end);
            if (start === null || end === null) return null;
            return {
              name: typeof o.name === "string" ? o.name : "Act",
              start,
              end,
              summary: typeof o.summary === "string" ? o.summary : "",
            };
          })
          .filter(Boolean)
      : [],
    copyHooks: Array.isArray(rawSA.copyHooks)
      ? rawSA.copyHooks.filter(
          (x): x is string => typeof x === "string"
        )
      : [],
  };

  return {
    ...extended,
    colloquialityScore: videoColloq,
    authenticityBand: asEnum(r.authenticityBand, [
      "low",
      "moderate",
      "high",
    ] as const),
    brandHeritageSalience: asEnum(r.brandHeritageSalience, [
      "absent",
      "moderate",
      "high",
    ] as const),
    audioExtended: {
      ...extAudio,
      voiceoverCadence,
    },
    hookDissection: {
      ...extHook,
      colloquialityScore: hookColloq,
    },
    emotionalArc: mergedArc,
    // Batch 4
    eyeContact,
    cutsMap,
    peopleAnalysis,
    scriptAngle,
  };
}
