import type { QwenAnalysis } from "../qwen-schema";
import type { VideoJob } from "./types";

export type UpdateJob = (id: string, patch: Partial<VideoJob>) => void;

/**
 * Concurrency-limited batch runner.
 *
 * Spins up `concurrency` workers that pull jobs off a shared queue until
 * drained. Each worker awaits processOne which calls the same pipeline as
 * the single-video flow (extractAll + Gemini analysis).
 */
export async function runBatch(
  jobs: VideoJob[],
  concurrency: number,
  updateJob: UpdateJob
): Promise<void> {
  const queue = [...jobs];
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, jobs.length)) },
    () => worker(queue, updateJob)
  );
  await Promise.all(workers);
}

async function worker(queue: VideoJob[], updateJob: UpdateJob): Promise<void> {
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      break;
    }
    await processOne(job, updateJob);
  }
}

async function processOne(job: VideoJob, updateJob: UpdateJob): Promise<void> {
  try {
    updateJob(job.id, {
      status: "extracting",
      step: "Extracting frames & audio",
      startedAt: Date.now(),
      progress: 0.05,
    });

    const { extractAll } = await import("../extractors");
    const extraction = await extractAll(job.file, (step, p) => {
      updateJob(job.id, { step, progress: p * 0.5 });
    });

    const thumbnailDataUrl = extraction.frames[0]?.dataUrl ?? null;

    updateJob(job.id, {
      status: "analyzing",
      step: "AI analysis",
      progress: 0.5,
      extraction,
      thumbnailDataUrl,
    });

    try {
      const analysis = await runQwen(extraction, job.file);
      updateJob(job.id, {
        status: "done",
        step: "Ready",
        progress: 1,
        finishedAt: Date.now(),
        qwen: analysis,
      });
    } catch (err) {
      console.warn(`[batch ${job.filename}] analysis failed`, err);
      updateJob(job.id, {
        status: "done",
        step: "Ready (analysis failed)",
        progress: 1,
        finishedAt: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    console.error(`[batch ${job.filename}] unrecoverable`, err);
    updateJob(job.id, {
      status: "error",
      error: err instanceof Error ? err.message : "Processing failed",
      finishedAt: Date.now(),
    });
  }
}

async function runQwen(
  extraction: import("../types").VideoExtraction,
  file: File
): Promise<QwenAnalysis> {
  const { uploadVideo } = await import("../blob-upload");
  const videoUrl = await uploadVideo(file);
  const { runAnalyzeJob } = await import("../analyze-client");
  return runAnalyzeJob({ metadata: extraction.metadata, videoUrl });
}
