"use client";

import type { QwenAnalysis } from "./qwen-schema";
import type { VideoMetadata } from "./types";

const POLL_INTERVAL_MS = 3000;
// Server's maxDuration is 300s plus ~15s of blob writes. Give polling a
// 360s ceiling so slow but successful analyses don't prematurely fail
// the client.
const POLL_TIMEOUT_MS = 360_000;

export type AnalyzeRequest = {
  metadata: VideoMetadata;
  videoUrl: string;
  modelId?: string;
};

export type AnalyzeJobOptions = {
  /** 0..1, fired while polling so callers can drive UI progress. */
  onProgress?: (fraction: number) => void;
};

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network")
  );
}

async function startJob(
  body: string
): Promise<{ jobId: string; resultUrl: string }> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch("/analyze/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Start HTTP ${res.status}`);
      }
      return (await res.json()) as { jobId: string; resultUrl: string };
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err) || attempt === maxAttempts) {
        throw err;
      }
      console.warn(
        `[analyze-client] start attempt ${attempt} failed, retrying…`,
        err
      );
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr ?? new Error("Failed to start analysis job");
}

/**
 * Fire-and-poll analyze call. Transient network failures during polling
 * don't sink the job — the server keeps running and we just retry on the
 * next tick. Only a server-side `status: "error"` or outright timeout
 * surfaces as an exception.
 */
export async function runAnalyzeJob(
  input: AnalyzeRequest,
  opts: AnalyzeJobOptions = {}
): Promise<QwenAnalysis> {
  const body = JSON.stringify(input);
  const { jobId, resultUrl } = await startJob(body);
  console.log(`[analyze-client] job started: ${jobId}`);

  const pollStart = Date.now();
  while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    if (opts.onProgress) {
      const elapsed = (Date.now() - pollStart) / 1000;
      opts.onProgress(Math.min(elapsed / 90, 1));
    }

    let data: {
      status?: string;
      analysis?: unknown;
      error?: string;
      hint?: string;
    } | null = null;
    try {
      const pollRes = await fetch(resultUrl, { cache: "no-store" });
      if (!pollRes.ok) {
        continue;
      }
      data = await pollRes.json();
    } catch (err) {
      console.warn(
        "[analyze-client] poll network error, retrying…",
        err instanceof Error ? err.message : err
      );
      continue;
    }

    if (data?.status === "done") {
      return data.analysis as QwenAnalysis;
    }
    if (data?.status === "error") {
      const msg = data.hint
        ? `${data.error}\n\n${data.hint}`
        : (data.error ?? "Analysis failed");
      throw new Error(msg);
    }
  }
  throw new Error("Analysis timed out — try again with a shorter video");
}
