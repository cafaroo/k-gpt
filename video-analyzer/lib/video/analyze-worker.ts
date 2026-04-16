import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateText } from "ai";
import { jsonrepair } from "jsonrepair";
import { getAnalysisModel } from "@/lib/ai/providers";
import { EXTENDED_SYSTEM_PROMPT } from "@/lib/video/analysis-extended-prompt";
import { AnalysisExtendedSchema } from "@/lib/video/analysis-extended-schema";
import {
  type AnalyzeMetrics,
  computeCompleteness,
  logMetrics,
  type PassMetrics,
  summarizeZodIssues,
} from "@/lib/video/analyze-metrics";
import { isRepairPassEnabled, runRepairPass } from "@/lib/video/analyze-repair";
import { adaptBase, adaptExtended } from "@/lib/video/gemini-adapter";
import { QWEN_SYSTEM_PROMPT } from "@/lib/video/qwen-prompt";
import {
  ensureBaseShape,
  normalizeScores,
  QwenAnalysisSchema,
} from "@/lib/video/qwen-schema";
import { schemaToSkeleton } from "@/lib/video/schema-to-skeleton";
import type { VideoMetadata } from "@/lib/video/types";

export type AnalyzeWorkerInput = {
  metadata: VideoMetadata;
  videoUrl: string;
  modelId?: string;
  runId?: string;
};

async function persistRun(
  runId: string,
  label: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  try {
    const dir = join(process.cwd(), ".analyze-runs", runId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `${label}.json`),
      JSON.stringify(payload, null, 2)
    );
  } catch (err) {
    console.warn(
      `[analyze] persistRun(${label}) failed:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Converts `"key": 1:01.5,` → `"key": 61.5,` for timestamp-like keys.
 * Gemini occasionally emits mm:ss values without quotes in numeric fields,
 * which is invalid JSON. We repair specifically on known timestamp keys so
 * we don't mangle legitimate strings elsewhere in the payload.
 */
const TIMESTAMP_KEYS = [
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

function normalizeUnquotedTimestamps(s: string): string {
  const pattern = new RegExp(
    `("(?:${TIMESTAMP_KEYS.join("|")})"\\s*:\\s*)(\\d+):(\\d+(?:\\.\\d+)?)`,
    "g"
  );
  return s.replace(pattern, (_, prefix, mm, ss) => {
    const decimal = Number(mm) * 60 + Number(ss);
    return `${prefix}${decimal}`;
  });
}

function extractJsonObject(s: string): string | null {
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
const GEMINI_TIMEOUT_MS = 240_000;
const RETRY_FAST_FAIL_WINDOW_MS = 20_000;
const RETRY_BACKOFF_MS = 2000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
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

function isTransient(err: unknown): boolean {
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
async function callGeminiWithRetry<T>(
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

type GenerateJsonResult = {
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
async function generateJson(opts: {
  model: ReturnType<typeof getAnalysisModel>;
  system: string;
  content: any;
  label: string;
  runId: string;
}): Promise<GenerateJsonResult> {
  const t0 = Date.now();
  const { value: text, retries } = await callGeminiWithRetry(async () => {
    const { text: t } = await generateText({
      model: opts.model,
      system: `${opts.system}\n\nReturn ONLY a single valid JSON object matching the described shape. No prose, no markdown fences, no comments.`,
      messages: [{ role: "user", content: opts.content }],
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

function buildPassMetrics(
  label: string,
  result: GenerateJsonResult,
  validationIssues: readonly {
    path: (string | number)[];
    code: string;
    message: string;
  }[]
): PassMetrics {
  const summarized = summarizeZodIssues(validationIssues as never);
  return {
    label,
    latencyMs: result.latencyMs,
    repaired: result.repaired,
    parseError: result.parseError,
    zodIssueCount: summarized.count,
    zodIssueSample: summarized.sample,
  };
}

export async function runAnalysis(
  input: AnalyzeWorkerInput
): Promise<Record<string, unknown>> {
  const { metadata, videoUrl, modelId } = input;
  const t0Total = Date.now();

  const vres = await fetch(videoUrl);
  if (!vres.ok) {
    throw new Error(`failed to fetch video blob (HTTP ${vres.status})`);
  }
  const videoBytes = new Uint8Array(await vres.arrayBuffer());
  const videoMediaType = vres.headers.get("content-type") ?? "video/mp4";
  console.log(
    `[analyze] video loaded: ${(videoBytes.byteLength / 1024 / 1024).toFixed(2)} MB ${videoMediaType}`
  );

  const metadataText = [
    "Video metadata:",
    `- filename: ${metadata.filename}`,
    `- duration: ${metadata.duration.toFixed(1)}s`,
    `- dimensions: ${metadata.width}×${metadata.height} (${metadata.aspectRatio})`,
  ].join("\n");

  const content = [
    { type: "text" as const, text: metadataText },
    {
      type: "file" as const,
      data: videoBytes,
      mediaType: videoMediaType,
    },
  ];

  const model = getAnalysisModel(modelId);
  const provider = process.env.ANALYSIS_PROVIDER ?? "gateway";
  const runId =
    input.runId ??
    `${new Date().toISOString().replace(/[:.]/g, "-")}_${metadata.filename.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}`;
  console.log(
    `[analyze] provider=${provider}, runId=${runId}, starting 2-pass...`
  );
  await persistRun(runId, "request", {
    timestamp: new Date().toISOString(),
    provider,
    modelId: modelId ?? "(default)",
    videoUrl,
    videoBytes: videoBytes.byteLength,
    videoMediaType,
    metadata,
  });

  const [baseResult, extResult] = await Promise.allSettled([
    generateJson({
      model,
      system: QWEN_SYSTEM_PROMPT,
      content,
      label: "base",
      runId,
    }),
    generateJson({
      model,
      system: EXTENDED_SYSTEM_PROMPT,
      content,
      label: "extended",
      runId,
    }),
  ]);

  const passMetrics: PassMetrics[] = [];

  // ─── Base pass ───────────────────────────────────────────────────────────
  if (baseResult.status === "rejected") {
    console.error(
      "[analyze] ❌ base pass failed:",
      baseResult.reason instanceof Error
        ? baseResult.reason.message
        : baseResult.reason
    );
    throw baseResult.reason;
  }
  const baseGen = baseResult.value;
  if (baseGen.parseError) {
    await persistRun(runId, "base", {
      timestamp: new Date().toISOString(),
      label: "base",
      ...baseGen,
    });
    throw new Error(`base pass parse error: ${baseGen.parseError}`);
  }

  const adaptedBase = adaptBase(baseGen.raw);
  const hydratedBase = ensureBaseShape(normalizeScores(adaptedBase));
  const baseValidation = QwenAnalysisSchema.safeParse(hydratedBase);
  const baseIssues = baseValidation.success ? [] : baseValidation.error.issues;
  if (baseIssues.length > 0) {
    console.warn(
      `[analyze] base hydrated Zod issues (${baseIssues.length}):`,
      summarizeZodIssues(baseIssues).sample
    );
  } else {
    console.log("[analyze] ✅ base pass schema-valid");
  }
  passMetrics.push(buildPassMetrics("base", baseGen, baseIssues));

  await persistRun(runId, "base", {
    timestamp: new Date().toISOString(),
    label: "base",
    latencyMs: baseGen.latencyMs,
    repaired: baseGen.repaired,
    parseError: baseGen.parseError,
    rawText: baseGen.rawText,
    raw: baseGen.raw,
    adapted: adaptedBase,
    hydrated: hydratedBase,
    zodIssueCount: baseIssues.length,
    zodIssues: summarizeZodIssues(baseIssues, 50).sample,
  });

  let repairPassTriggered = false;
  let effectiveBase = hydratedBase;

  // Optional repair-pass: if hydrated base has too many empty arrays, ask a
  // cheap flash model to reshape the raw output against the schema skeleton.
  if (isRepairPassEnabled()) {
    const before = computeCompleteness(
      hydratedBase as unknown as Record<string, unknown>
    );
    if (before.score < 0.5) {
      console.warn(
        `[analyze] base completeness ${before.score.toFixed(2)} < 0.5, running repair pass`
      );
      try {
        const repaired = await runRepairPass({
          rawJson: baseGen.raw,
          schemaSkeleton: schemaToSkeleton(QwenAnalysisSchema),
          label: "base-repair",
        });
        if (repaired.raw && !repaired.parseError) {
          const hydrated2 = ensureBaseShape(
            normalizeScores(adaptBase(repaired.raw))
          );
          const after = computeCompleteness(
            hydrated2 as unknown as Record<string, unknown>
          );
          if (after.score > before.score) {
            console.log(
              `[analyze] base repair improved completeness ${before.score.toFixed(
                2
              )} → ${after.score.toFixed(2)}`
            );
            effectiveBase = hydrated2;
            repairPassTriggered = true;
            await persistRun(runId, "base-repair", {
              timestamp: new Date().toISOString(),
              latencyMs: repaired.latencyMs,
              rawText: repaired.rawText,
              raw: repaired.raw,
              hydrated: hydrated2,
              completenessBefore: before,
              completenessAfter: after,
            });
          }
        }
      } catch (err) {
        console.warn(
          "[analyze] repair pass failed:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const analysis: Record<string, unknown> = { ...effectiveBase };

  // ─── Extended pass ───────────────────────────────────────────────────────
  if (extResult.status === "rejected") {
    const message =
      extResult.reason instanceof Error
        ? extResult.reason.message
        : "Extended analysis failed";
    console.error("[analyze] ❌ extended pass failed:", message);
    analysis.extendedError = message;
    passMetrics.push({
      label: "extended",
      latencyMs: 0,
      repaired: false,
      parseError: message,
      zodIssueCount: 0,
      zodIssueSample: [],
    });
  } else {
    const extGen = extResult.value;
    if (extGen.parseError) {
      console.error(
        "[analyze] ❌ extended pass parse error:",
        extGen.parseError
      );
      analysis.extendedError = extGen.parseError;
      passMetrics.push(buildPassMetrics("extended", extGen, []));
    } else {
      const adaptedExt = adaptExtended(extGen.raw);
      const normalizedExt = normalizeScores(adaptedExt);
      const extValidation = AnalysisExtendedSchema.safeParse(normalizedExt);
      const extIssues = extValidation.success ? [] : extValidation.error.issues;
      if (extIssues.length > 0) {
        console.warn(
          `[analyze] extended hydrated Zod issues (${extIssues.length}):`,
          summarizeZodIssues(extIssues).sample
        );
      } else {
        console.log("[analyze] ✅ extended pass schema-valid");
      }
      passMetrics.push(buildPassMetrics("extended", extGen, extIssues));

      // Accept the hydrated payload even if some leaf fields fail Zod —
      // ensureBaseShape-equivalent defaults already live inside adaptExtended.
      // Downstream cards expect consistent shape; Zod issues are logged for
      // prompt-tuning follow-up.
      analysis.extended = normalizedExt;

      const pacing = effectiveBase.pacing;
      const emotionalArc = (normalizedExt as { emotionalArc?: unknown[] })
        .emotionalArc;
      if (
        pacing.intensityCurve.length === 0 &&
        Array.isArray(emotionalArc) &&
        emotionalArc.length > 0
      ) {
        pacing.intensityCurve = emotionalArc
          .map((p) => {
            const o = p as Record<string, unknown>;
            return {
              time: typeof o.timestamp === "number" ? o.timestamp : 0,
              intensity: typeof o.intensity === "number" ? o.intensity : 0,
              note:
                typeof o.note === "string"
                  ? o.note
                  : typeof o.primary === "string"
                    ? o.primary
                    : "",
            };
          })
          .filter((p) => Number.isFinite(p.time));
      }

      await persistRun(runId, "extended", {
        timestamp: new Date().toISOString(),
        label: "extended",
        latencyMs: extGen.latencyMs,
        repaired: extGen.repaired,
        parseError: extGen.parseError,
        rawText: extGen.rawText,
        raw: extGen.raw,
        adapted: adaptedExt,
        normalized: normalizedExt,
        zodIssueCount: extIssues.length,
        zodIssues: summarizeZodIssues(extIssues, 50).sample,
      });
    }
  }

  await persistRun(runId, "final", {
    timestamp: new Date().toISOString(),
    analysis,
  });

  const completeness = computeCompleteness(analysis);
  const retryCount =
    (baseResult.status === "fulfilled" ? baseResult.value.retries : 0) +
    (extResult.status === "fulfilled" ? extResult.value.retries : 0);
  const metrics: AnalyzeMetrics = {
    runId,
    totalLatencyMs: Date.now() - t0Total,
    completeness,
    passes: passMetrics,
    repairPassTriggered,
    retryCount,
  };
  logMetrics(metrics);
  console.log(`[analyze] runId=${runId} saved to .analyze-runs/${runId}/`);

  return analysis;
}
