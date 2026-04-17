import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
import {
  type GenerateJsonResult,
  callGeminiJson as generateJson,
} from "@/lib/video/v2/gemini-call";

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
    }),
    generateJson({
      model,
      system: EXTENDED_SYSTEM_PROMPT,
      content,
      label: "extended",
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
