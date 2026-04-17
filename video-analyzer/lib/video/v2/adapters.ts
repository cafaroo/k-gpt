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

  return {
    ...base,
    pacing: {
      ...basePacing,
      sceneComplexity,
    },
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
  };
}
