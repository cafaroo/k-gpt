import { generateText } from "ai";
import { jsonrepair } from "jsonrepair";
import type { getAnalysisModel } from "@/lib/ai/providers";

/**
 * Converts `"key": 1:01.5,` → `"key": 61.5,` for timestamp-like keys.
 * Gemini occasionally emits mm:ss values without quotes in numeric fields,
 * which is invalid JSON. We repair specifically on known timestamp keys so
 * we don't mangle legitimate strings elsewhere in the payload.
 */
export const TIMESTAMP_KEYS = [
  "start",
  "end",
  "time",
  "timestamp",
  "second",
  "firstGlimpseAt",
  "fullRevealAt",
  "resolvesAt",
  "duration",
  "timeToFirstVisualChange",
];

export function normalizeUnquotedTimestamps(s: string): string {
  const pattern = new RegExp(
    `("(?:${TIMESTAMP_KEYS.join("|")})"\\s*:\\s*)(\\d+):(\\d+(?:\\.\\d+)?)`,
    "g"
  );
  return s.replace(pattern, (_, prefix, mm, ss) => {
    const decimal = Number(mm) * 60 + Number(ss);
    return `${prefix}${decimal}`;
  });
}

export function extractJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

// Upper bound per Gemini call. Base pass with the expanded prompt + skeleton
// typically runs 60-90s but can spike to 150s+ on cold paths. Extended pass
// with 88-sample curves (swipeRisk, emotionalArc) runs similar. Both passes
// execute in parallel so worst-case wall-clock ≈ GEMINI_TIMEOUT_MS, safely
// under the route's maxDuration=300s budget.
export const GEMINI_TIMEOUT_MS = 240_000;
export const RETRY_FAST_FAIL_WINDOW_MS = 20_000;
export const RETRY_BACKOFF_MS = 2000;

export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|\b(?:429|500|502|503|504)\b|rate.?limit|temporarily|overloaded/i.test(
    msg
  );
}

/**
 * Calls Gemini with a timeout, retrying once if the first attempt failed
 * fast and on a transient error. We don't retry slow failures (near-timeout)
 * because the caller is under a 120s maxDuration ceiling.
 */
export async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<{ value: T; retries: number }> {
  const t0 = Date.now();
  try {
    const value = await withTimeout(fn(), GEMINI_TIMEOUT_MS, label);
    return { value, retries: 0 };
  } catch (err) {
    const elapsed = Date.now() - t0;
    if (elapsed >= RETRY_FAST_FAIL_WINDOW_MS || !isTransient(err)) {
      throw err;
    }
    console.warn(
      `[analyze] ${label} transient fail @${elapsed}ms, retrying once:`,
      err instanceof Error ? err.message : err
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    const value = await withTimeout(fn(), GEMINI_TIMEOUT_MS, label);
    return { value, retries: 1 };
  }
}

export type GenerateJsonResult = {
  raw: unknown;
  rawText: string;
  latencyMs: number;
  repaired: boolean;
  parseError: string | null;
  retries: number;
};

/**
 * Pulls JSON out of a Gemini response. Does NOT validate against a schema —
 * that's done later on the adapter-hydrated output so we measure real
 * schema-compliance instead of shape-translation noise.
 */
export async function callGeminiJson(opts: {
  model: ReturnType<typeof getAnalysisModel>;
  system: string;
  content: any;
  label: string;
}): Promise<GenerateJsonResult> {
  const t0 = Date.now();
  const { value: text, retries } = await callGeminiWithRetry(async () => {
    const { text: t } = await generateText({
      model: opts.model,
      system: `${opts.system}\n\nReturn ONLY a single valid JSON object matching the described shape. No prose, no markdown fences, no comments.`,
      messages: [{ role: "user", content: opts.content }],
      // Deterministic sampling: low temperature + fixed seed. Same video
      // input → same output across runs (modulo minor provider-side
      // indeterminism). Seed is shared between base and extended passes
      // intentionally — the two prompts differ enough that this doesn't
      // collapse responses. Bump this number if you ever need to force
      // regeneration of all cached analyses.
      temperature: 0.15,
      topP: 0.9,
      seed: 42,
    });
    return t;
  }, opts.label);
  const latencyMs = Date.now() - t0;

  const fenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const stripped = extractJsonObject(fenced) ?? fenced;

  let parsed: unknown = null;
  let parseError: string | null = null;
  let repaired = false;

  // Cascade: plain parse → time-normalize → jsonrepair → time-normalize + jsonrepair
  const attempts: { label: string; build: () => string }[] = [
    { label: "plain", build: () => stripped },
    {
      label: "time-normalized",
      build: () => normalizeUnquotedTimestamps(stripped),
    },
    { label: "jsonrepair", build: () => jsonrepair(stripped) },
    {
      label: "time-normalized+jsonrepair",
      build: () => jsonrepair(normalizeUnquotedTimestamps(stripped)),
    },
  ];

  let lastErr: unknown = null;
  for (const attempt of attempts) {
    try {
      parsed = JSON.parse(attempt.build());
      if (attempt.label !== "plain") {
        repaired = true;
        console.warn(
          `[analyze] ${opts.label} JSON.parse recovered via "${attempt.label}"`
        );
      }
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (parsed === null) {
    parseError = lastErr instanceof Error ? lastErr.message : String(lastErr);
    console.error(
      `[analyze] ${opts.label} JSON.parse failed. First 500 chars:\n${stripped.slice(0, 500)}`
    );
  }

  return {
    raw: parsed,
    rawText: text,
    latencyMs,
    repaired,
    parseError,
    retries,
  };
}
