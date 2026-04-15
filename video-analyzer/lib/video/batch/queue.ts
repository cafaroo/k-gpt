import type { AudioAnalysis } from "../audio-schema";
import type { QwenAnalysis } from "../qwen-schema";
import type { VideoJob } from "./types";

export type UpdateJob = (id: string, patch: Partial<VideoJob>) => void;

/**
 * Concurrency-limited batch runner.
 *
 * Spins up `concurrency` workers that pull jobs off a shared queue until
 * drained. Each worker awaits processOne which calls the same pipeline as
 * the single-video flow (extractAll → Qwen + Gemini in parallel).
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

    const qwenPromise = runQwen(extraction);
    const audioPromise = runAudio(job.file);

    const [qwenResult, audioResult] = await Promise.allSettled([
      qwenPromise,
      audioPromise,
    ]);

    const patch: Partial<VideoJob> = {
      status: "done",
      step: "Ready",
      progress: 1,
      finishedAt: Date.now(),
    };

    if (qwenResult.status === "fulfilled") {
      patch.qwen = qwenResult.value;
    } else {
      console.warn(`[batch ${job.filename}] qwen failed`, qwenResult.reason);
    }
    if (audioResult.status === "fulfilled") {
      patch.audio = audioResult.value;
    } else {
      console.warn(`[batch ${job.filename}] audio failed`, audioResult.reason);
    }

    const errors: string[] = [];
    if (qwenResult.status === "rejected") {
      errors.push(
        `visual: ${qwenResult.reason instanceof Error ? qwenResult.reason.message : String(qwenResult.reason)}`
      );
    }
    if (audioResult.status === "rejected") {
      errors.push(
        `audio: ${audioResult.reason instanceof Error ? audioResult.reason.message : String(audioResult.reason)}`
      );
    }
    if (errors.length > 0 && !patch.qwen && !patch.audio) {
      patch.status = "error";
      patch.error = errors.join(" · ");
    } else if (errors.length > 0) {
      patch.error = errors.join(" · ");
    }

    updateJob(job.id, patch);
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
  extraction: import("../types").VideoExtraction
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

  const res = await fetch("/analyze/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      metadata: extraction.metadata,
      audioText,
      motionText,
      frameDataUrls: sampled.map((f) => f.dataUrl),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `visual HTTP ${res.status}`);
  }
  const { analysis } = (await res.json()) as { analysis: QwenAnalysis };
  return analysis;
}

async function runAudio(file: File): Promise<AudioAnalysis> {
  const { encodeVideoAudioToWav } = await import("../audio-extract");
  const wav = await encodeVideoAudioToWav(file);
  const res = await fetch("/analyze/api/audio", {
    method: "POST",
    headers: { "Content-Type": wav.type || "audio/wav" },
    body: wav,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `audio HTTP ${res.status}`);
  }
  const { analysis } = (await res.json()) as { analysis: AudioAnalysis };
  return analysis;
}
