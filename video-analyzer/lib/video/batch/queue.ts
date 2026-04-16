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
  const sampled =
    extraction.frames.length <= 16
      ? extraction.frames
      : Array.from(
          { length: 16 },
          (_, i) =>
            extraction.frames[Math.floor((i * extraction.frames.length) / 16)]
        );

  const { summarizeExtraction } = await import("../extraction-summary");
  const { audioText, motionText } = summarizeExtraction({
    audioSegments: extraction.audioSegments,
    motionSegments: extraction.motionSegments,
    sceneChanges: extraction.sceneChanges,
    duration: extraction.metadata.duration,
  });

  let videoUrl: string | null = null;
  try {
    const { uploadVideo } = await import("../blob-upload");
    videoUrl = await uploadVideo(file);
  } catch (err) {
    console.warn(`[batch ${file.name}] video upload failed`, err);
  }

  const res = await fetch("/analyze/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      metadata: extraction.metadata,
      audioText,
      motionText,
      frameDataUrls: sampled.map((f) => f.dataUrl),
      ...(videoUrl ? { videoUrl } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `visual HTTP ${res.status}`);
  }
  const { analysis } = (await res.json()) as { analysis: QwenAnalysis };
  return analysis;
}
