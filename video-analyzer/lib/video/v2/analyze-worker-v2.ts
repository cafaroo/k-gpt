import { eq } from "drizzle-orm";
import { getAnalysisModel } from "@/lib/ai/providers";
import { db } from "@/lib/db/queries";
import { analysis as analysisTable } from "@/lib/db/schema";
import {
  type AnalyzeMetrics,
  computeCompleteness,
  logMetrics,
  type PassMetrics,
  summarizeZodIssues,
} from "@/lib/video/analyze-metrics";
import { adaptBase, adaptExtended } from "@/lib/video/gemini-adapter";
import {
  ensureBaseShape,
  normalizeScores,
} from "@/lib/video/qwen-schema";
import type { VideoMetadata } from "@/lib/video/types";
import {
  AnalysisExtendedV2Schema,
  QwenAnalysisV2Schema,
} from "./analysis-v2-schema";
import { QWEN_V2_SYSTEM_PROMPT } from "./analysis-v2-base-prompt";
import { EXTENDED_V2_SYSTEM_PROMPT } from "./analysis-v2-extended-prompt";
import { callGeminiJson } from "./gemini-call";
import {
  computeComplexityAdjustedRhythm,
  computeEcr,
  computeNawp,
  matchEmotionalBigram,
} from "./scorers";

export type AnalyzeV2Input = {
  analysisId: string;
  videoId: string;
  userId: string;
  videoUrl: string;
  metadata: VideoMetadata;
};

export async function runAnalysisV2(input: AnalyzeV2Input): Promise<void> {
  const t0 = Date.now();
  const { analysisId, videoUrl, metadata } = input;

  try {
    // Step 1: fetch video
    const vres = await fetch(videoUrl);
    if (!vres.ok) {
      throw new Error(`failed to fetch video blob (HTTP ${vres.status})`);
    }
    const videoBytes = new Uint8Array(await vres.arrayBuffer());
    const videoMediaType = vres.headers.get("content-type") ?? "video/mp4";

    const metadataText = [
      "Video metadata:",
      `- filename: ${metadata.filename}`,
      `- duration: ${metadata.duration.toFixed(1)}s`,
      `- dimensions: ${metadata.width}×${metadata.height} (${metadata.aspectRatio})`,
    ].join("\n");

    const content = [
      { type: "text" as const, text: metadataText },
      { type: "file" as const, data: videoBytes, mediaType: videoMediaType },
    ];

    const model = getAnalysisModel();
    const runLabel = `v2-${analysisId}`;

    // Step 2+3: parallel base + extended
    const [baseRes, extRes] = await Promise.allSettled([
      callGeminiJson({
        model,
        system: QWEN_V2_SYSTEM_PROMPT,
        content,
        label: "v2-base",
      }),
      callGeminiJson({
        model,
        system: EXTENDED_V2_SYSTEM_PROMPT,
        content,
        label: "v2-extended",
      }),
    ]);

    if (baseRes.status === "rejected") throw baseRes.reason;

    // Step 4: adapt + hydrate + validate
    const adaptedBase = adaptBase(baseRes.value.raw);
    const hydratedBase = ensureBaseShape(normalizeScores(adaptedBase));
    const baseVal = QwenAnalysisV2Schema.safeParse(hydratedBase);
    const baseIssues = baseVal.success ? [] : baseVal.error.issues;

    let extendedPayload: unknown = null;
    let extendedError: string | null = null;
    let extendedIssues: readonly unknown[] = [];
    if (extRes.status === "rejected") {
      extendedError =
        extRes.reason instanceof Error
          ? extRes.reason.message
          : "extended pass failed";
    } else if (extRes.value.parseError) {
      extendedError = extRes.value.parseError;
    } else {
      const adaptedExt = adaptExtended(extRes.value.raw);
      const normalized = normalizeScores(adaptedExt);
      const extVal = AnalysisExtendedV2Schema.safeParse(normalized);
      extendedIssues = extVal.success ? [] : extVal.error.issues;
      extendedPayload = normalized;
    }

    // Step 5: post-hoc scorers — run AFTER hydration
    const analysis = {
      ...hydratedBase,
      extended: extendedPayload ?? undefined,
      extendedError: extendedError ?? undefined,
    } as Record<string, unknown>;

    // Post-hoc scorers
    const hook = (hydratedBase.hook ?? {}) as Record<string, any>;
    const hookDissection =
      (extendedPayload as any)?.hookDissection ?? {};
    const visual = (hydratedBase.visual ?? {}) as Record<string, any>;
    const pacing = (hydratedBase.pacing ?? {}) as Record<string, any>;

    const ecr = computeEcr({
      hookScore: Number(hook.score ?? 0),
      timeToFirstVisualChange: Number(hook.timeToFirstVisualChange ?? 2),
      stopPower: Number(hookDissection.stopPower ?? 5),
      dominantFaceRatio: Number(visual.dominantFaceRatio ?? 0),
      hookColloquiality: Number(hookDissection.colloquialityScore ?? 5),
    });

    const arc = (extendedPayload as any)?.emotionalArc ?? [];
    const bigram = matchEmotionalBigram(arc);

    const nawp = computeNawp({
      durationSec: metadata.duration,
      pacingScore: Number(pacing.score ?? 5),
      payoffIsEarly: Boolean(
        (hydratedBase.payoffTiming as any)?.isEarly ?? false
      ),
      emotionalFlowMatchScore: bigram.value,
    });

    const rhythm = computeComplexityAdjustedRhythm({
      cutsPerMinute: Number(pacing.cutsPerMinute ?? 0),
      sceneComplexity: pacing.sceneComplexity ?? [],
    });

    // Patch predictions into base shape
    (analysis as any).predictedMetrics = {
      ...(hydratedBase.predictedMetrics ?? {}),
      ecr: ecr.value,
      nawp: nawp.value,
      ecrRationale: ecr.rationale,
      nawpRationale: nawp.rationale,
    };
    (analysis as any).pacing = {
      ...(hydratedBase.pacing ?? {}),
      complexityAdjustedRhythm: rhythm.value,
    };
    if (extendedPayload) {
      (extendedPayload as any).emotionalFlowSequence = bigram.sequence;
      (extendedPayload as any).emotionalFlowMatchScore = bigram.value;
    }
    const researchMeta = {
      ecr: { value: ecr.value, rationale: ecr.rationale },
      nawp: { value: nawp.value, rationale: nawp.rationale },
      bigram: {
        value: bigram.value,
        sequence: bigram.sequence,
        matched: bigram.matchedPatterns,
        rationale: bigram.rationale,
      },
      complexityRhythm: { value: rhythm.value, rationale: rhythm.rationale },
    };

    // Step 6: persist — TODO (3.3) write to Postgres + Blob.

    // Step 7: metrics
    const completeness = computeCompleteness(analysis);
    const metrics: AnalyzeMetrics = {
      runId: runLabel,
      totalLatencyMs: Date.now() - t0,
      completeness,
      passes: [
        {
          label: "base",
          latencyMs: baseRes.status === "fulfilled" ? baseRes.value.latencyMs : 0,
          repaired: baseRes.status === "fulfilled" ? baseRes.value.repaired : false,
          parseError: null,
          zodIssueCount: baseIssues.length,
          zodIssueSample: summarizeZodIssues(baseIssues as never).sample,
        },
        {
          label: "extended",
          latencyMs: extRes.status === "fulfilled" ? extRes.value.latencyMs : 0,
          repaired: extRes.status === "fulfilled" ? extRes.value.repaired : false,
          parseError: extendedError,
          zodIssueCount: extendedIssues.length,
          zodIssueSample: summarizeZodIssues(extendedIssues as never).sample,
        },
      ],
      repairPassTriggered: false,
      retryCount:
        (baseRes.status === "fulfilled" ? baseRes.value.retries : 0) +
        (extRes.status === "fulfilled" ? extRes.value.retries : 0),
    };
    logMetrics(metrics);

    // TODO (3.3): UPDATE analyses SET status='done'.
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(analysisTable)
      .set({
        status: "error",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(analysisTable.id, analysisId));
  }
}
