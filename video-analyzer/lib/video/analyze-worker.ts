import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateText } from "ai";
import { jsonrepair } from "jsonrepair";
import type { z } from "zod";
import { getAnalysisModel } from "@/lib/ai/providers";
import { EXTENDED_SYSTEM_PROMPT } from "@/lib/video/analysis-extended-prompt";
import { AnalysisExtendedSchema } from "@/lib/video/analysis-extended-schema";
import { adaptBase, adaptExtended } from "@/lib/video/gemini-adapter";
import { QWEN_SYSTEM_PROMPT } from "@/lib/video/qwen-prompt";
import {
  ensureBaseShape,
  normalizeScores,
  QwenAnalysisSchema,
} from "@/lib/video/qwen-schema";
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

async function generateJson<T>(opts: {
  model: ReturnType<typeof getAnalysisModel>;
  schema: z.ZodType<T>;
  system: string;
  content: any;
  label: string;
  runId: string;
}): Promise<T> {
  const t0 = Date.now();
  const { text } = await generateText({
    model: opts.model,
    system: `${opts.system}\n\nReturn ONLY a single valid JSON object matching the described shape. No prose, no markdown fences, no comments.`,
    messages: [{ role: "user", content: opts.content }],
  });
  const latencyMs = Date.now() - t0;

  const fenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const stripped = extractJsonObject(fenced) ?? fenced;

  let parsed: unknown;
  let parseError: string | null = null;
  let repaired = false;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    try {
      const fixed = jsonrepair(stripped);
      parsed = JSON.parse(fixed);
      repaired = true;
      console.warn(
        `[analyze] ${opts.label} JSON.parse failed, jsonrepair recovered`
      );
    } catch {
      parseError = err instanceof Error ? err.message : String(err);
      console.error(
        `[analyze] ${opts.label} JSON.parse failed. First 500 chars:\n${stripped.slice(0, 500)}`
      );
    }
  }

  const result = parsed
    ? opts.schema.safeParse(parsed)
    : { success: false as const, error: { issues: [] } };
  const zodIssues = result.success
    ? []
    : (
        (result as { error: { issues: unknown[] } }).error.issues as Array<{
          path: unknown[];
          code: string;
          message: string;
        }>
      ).map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: i.message,
      }));

  if (zodIssues.length > 0) {
    console.warn(
      `[analyze] ${opts.label} Zod issues (${zodIssues.length}):`,
      zodIssues.slice(0, 8)
    );
  }

  await persistRun(opts.runId, opts.label, {
    timestamp: new Date().toISOString(),
    label: opts.label,
    latencyMs,
    parseError,
    repaired,
    zodIssueCount: zodIssues.length,
    zodIssues: zodIssues.slice(0, 50),
    rawText: text,
    parsed,
  });

  if (parseError) {
    throw new Error(parseError);
  }
  if (!result.success) {
    return parsed as T;
  }
  return (result as { data: T }).data;
}

export async function runAnalysis(
  input: AnalyzeWorkerInput
): Promise<Record<string, unknown>> {
  const { metadata, videoUrl, modelId } = input;

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
      schema: QwenAnalysisSchema,
      system: QWEN_SYSTEM_PROMPT,
      content,
      label: "base",
      runId,
    })
      .then((r) => {
        console.log("[analyze] ✅ base pass done");
        return r;
      })
      .catch((e: unknown) => {
        console.error(
          "[analyze] ❌ base pass failed:",
          e instanceof Error ? e.message : e
        );
        throw e;
      }),
    generateJson({
      model,
      schema: AnalysisExtendedSchema,
      system: EXTENDED_SYSTEM_PROMPT,
      content,
      label: "extended",
      runId,
    })
      .then((r) => {
        console.log("[analyze] ✅ extended pass done");
        return r;
      })
      .catch((e: unknown) => {
        console.error(
          "[analyze] ❌ extended pass failed:",
          e instanceof Error ? e.message : e
        );
        throw e;
      }),
  ]);

  if (baseResult.status === "rejected") {
    throw baseResult.reason;
  }

  const adaptedBase = adaptBase(baseResult.value);
  const hydratedBase = ensureBaseShape(normalizeScores(adaptedBase));
  const analysis: Record<string, unknown> = { ...hydratedBase };
  if (extResult.status === "fulfilled") {
    const adaptedExt = adaptExtended(extResult.value);
    analysis.extended = normalizeScores(adaptedExt);

    const pacing = hydratedBase.pacing;
    if (
      pacing.intensityCurve.length === 0 &&
      adaptedExt.emotionalArc.length > 0
    ) {
      pacing.intensityCurve = adaptedExt.emotionalArc.map(
        (p: {
          timestamp: number;
          intensity: number;
          note?: string;
          primary: string;
        }) => ({
          time: p.timestamp,
          intensity: p.intensity,
          note: p.note ?? p.primary,
        })
      );
    }
  } else {
    analysis.extendedError =
      extResult.reason instanceof Error
        ? extResult.reason.message
        : "Extended analysis failed";
  }

  await persistRun(runId, "final", {
    timestamp: new Date().toISOString(),
    analysis,
  });
  console.log(`[analyze] runId=${runId} saved to .analyze-runs/${runId}/`);

  return analysis;
}
