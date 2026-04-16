import { put } from "@vercel/blob";
import { after } from "next/server";
import { runAnalysis } from "@/lib/video/analyze-worker";
import type { VideoMetadata } from "@/lib/video/types";

// 300s is Vercel's current default ceiling. Gemini runs comfortably under it
// but the 2-pass analysis with expanded prompts can push 150-200s per pass.
export const maxDuration = 300;

type RequestBody = {
  metadata: VideoMetadata;
  videoUrl: string;
  modelId?: string;
};

const RESULT_PREFIX = "analysis/results";

function resultPath(jobId: string): string {
  return `${RESULT_PREFIX}/${jobId}.json`;
}

async function writeResult(
  jobId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { url } = await put(resultPath(jobId), JSON.stringify(payload), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
  return url;
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

    const jobId = crypto.randomUUID();
    const resultUrl = await writeResult(jobId, {
      status: "pending",
      startedAt: new Date().toISOString(),
    });

    // Run analysis after the response is sent. Vercel keeps the function
    // warm for maxDuration (120s), which is plenty for 2-pass Gemini. The
    // result blob is overwritten with either `done` or `error` — clients
    // poll resultUrl and no longer hold a long-lived POST hostage to
    // network flakes.
    after(async () => {
      try {
        const analysis = await runAnalysis({ metadata, videoUrl, modelId });
        await writeResult(jobId, {
          status: "done",
          finishedAt: new Date().toISOString(),
          analysis,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        const isCreditError =
          /free credits|no_providers_available|restricted access/i.test(
            message
          );
        await writeResult(jobId, {
          status: "error",
          finishedAt: new Date().toISOString(),
          error: message,
          hint: isCreditError
            ? "Vercel AI Gateway free credits are temporarily restricted — top up at vercel.com/ai."
            : undefined,
        });
      }
    });

    return Response.json({ jobId, resultUrl }, { status: 202 });
  } catch (err) {
    console.error("[/analyze/api/analyze] start failed:", err);
    const message = err instanceof Error ? err.message : "Failed to start";
    return Response.json({ error: message }, { status: 500 });
  }
}
