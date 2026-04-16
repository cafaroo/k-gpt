import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateText } from "ai";
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

export const maxDuration = 120;

type RequestBody = {
  metadata: VideoMetadata;
  /** Public Vercel Blob URL for the original video. */
  videoUrl: string;
  modelId?: string;
};

/**
 * Generate a JSON object by prompting Gemini with text + video, then parse.
 * Google's structured-output refuses any non-trivial Zod schema with "too many
 * states for serving", so we use generateText and hand-parse instead.
 */
/**
 * Persist a Gemini run to .analyze-runs/ in the repo root so we can iterate
 * on schema/prompt without re-running the model. Local dev only — skipped
 * silently in production where the FS is read-only.
 */
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
 * Scan for the first balanced top-level `{...}` object in `s`. Respects
 * JSON string escaping so braces inside strings don't throw off the depth
 * counter. Returns null if no balanced object is found.
 */
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

  // Gemini occasionally appends a trailing newline + prose/comment after the
  // JSON object. Parse only the balanced slice between the first `{` and the
  // matching closing `}` so trailing content doesn't break the parse.
  const stripped = extractJsonObject(fenced) ?? fenced;

  let parsed: unknown;
  let parseError: string | null = null;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
    console.error(
      `[analyze] ${opts.label} JSON.parse failed. First 500 chars:\n${stripped.slice(0, 500)}`
    );
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

  // Persist the full run for offline iteration.
  await persistRun(opts.runId, opts.label, {
    timestamp: new Date().toISOString(),
    label: opts.label,
    latencyMs,
    parseError,
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

export async function POST(req: Request) {
  try {
    const { metadata, videoUrl, modelId } = (await req.json()) as RequestBody;

    if (!(metadata && videoUrl)) {
      return Response.json(
        { error: "metadata and videoUrl are required" },
        { status: 400 }
      );
    }

    // Fetch the video bytes once from the public blob and reuse for both
    // passes. Fetching here instead of sending the URL lets AI SDK base64 the
    // bytes into the Gemini request, bypassing any Gemini-side URL fetch.
    const vres = await fetch(videoUrl);
    if (!vres.ok) {
      return Response.json(
        { error: `failed to fetch video blob (HTTP ${vres.status})` },
        { status: 400 }
      );
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
    const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}_${metadata.filename.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}`;
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

      // Gemini frequently returns pacing.intensityCurve=[] despite the prompt.
      // emotionalArc carries per-second intensity that maps cleanly to
      // engagement intensity — use it as a fallback so the curve stays alive.
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

    return Response.json({ analysis });
  } catch (err) {
    console.error("[/analyze/api/analyze] failed:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    const isCreditError =
      /free credits|no_providers_available|restricted access/i.test(message);
    return Response.json(
      {
        error: message,
        hint: isCreditError
          ? "Vercel AI Gateway free credits are temporarily restricted — top up at vercel.com/ai."
          : undefined,
      },
      { status: isCreditError ? 402 : 500 }
    );
  }
}
