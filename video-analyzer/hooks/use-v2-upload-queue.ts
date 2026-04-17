"use client";
import { upload } from "@vercel/blob/client";
import { useCallback, useRef, useState } from "react";

// Exponential backoff retry — handles flaky networks (ERR_NETWORK_CHANGED,
// transient 5xx, timeouts). 4 attempts with 1s / 2s / 4s / 8s spacing.
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 4
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = 1000 * 2 ** i + Math.random() * 300;
      console.warn(
        `[v2 upload] ${label} attempt ${i + 1}/${attempts} failed, retrying in ${Math.round(delay)}ms`,
        err
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export type QueueItem = {
  id: string;
  file: File;
  state: "queued" | "uploading" | "analyzing" | "done" | "error";
  progress?: number;
  videoId?: string;
  analysisId?: string;
  errorMessage?: string;
};

const MAX_CONCURRENT = 3;

function probeMetadata(file: File): Promise<{
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
}> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    el.onloadedmetadata = () => {
      const aspectRatio = `${el.videoWidth}:${el.videoHeight}`;
      resolve({
        duration: el.duration,
        width: el.videoWidth,
        height: el.videoHeight,
        aspectRatio,
      });
      URL.revokeObjectURL(el.src);
    };
    el.onerror = () => reject(new Error("video metadata probe failed"));
    el.src = URL.createObjectURL(file);
  });
}

export function useV2UploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const activeRef = useRef(0);
  // Ref holds latest `pump` so runOne can call it without creating a
  // circular callback dependency.
  const pumpRef = useRef<() => void>(() => {
    /* noop until set */
  });

  const patch = useCallback((id: string, change: Partial<QueueItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...change } : it))
    );
  }, []);

  const pollJob = useCallback(
    async (itemId: string, analysisId: string) => {
      const deadline = Date.now() + 360_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const res = await fetch(`/analyze/v2/api/jobs/${analysisId}`);
        if (!res.ok) {
          continue;
        }
        const data = (await res.json()) as {
          status: "pending" | "done" | "error";
          errorMessage?: string;
        };
        if (data.status === "done") {
          patch(itemId, { state: "done" });
          return;
        }
        if (data.status === "error") {
          patch(itemId, {
            state: "error",
            errorMessage: data.errorMessage ?? "analysis failed",
          });
          return;
        }
      }
      patch(itemId, { state: "error", errorMessage: "timeout" });
    },
    [patch]
  );

  const runOne = useCallback(
    async (item: QueueItem) => {
      try {
        const meta = await probeMetadata(item.file);
        patch(item.id, { state: "uploading", progress: 0 });

        // 1. Direct-to-Blob upload (browser → Vercel Blob). Bypasses the
        //    ~4.5 MB request-body limit on serverless functions.
        const ext = item.file.name.split(".").pop()?.toLowerCase() || "mp4";
        const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `v2/videos/${Date.now()}-${safeName}.${ext}`;
        const blob = await withRetry(
          () =>
            upload(path, item.file, {
              access: "public",
              handleUploadUrl: "/api/blob/upload",
              contentType: item.file.type || "video/mp4",
              // Avoid blob collisions on retry after a failed network upload.
              addRandomSuffix: true,
              // 5 MB resumable chunks — survives transient network flaps
              // (ERR_NETWORK_CHANGED) much better than a single PUT.
              multipart: true,
              onUploadProgress: ({ percentage }) => {
                patch(item.id, { progress: percentage });
              },
            }),
          "blob-upload"
        );

        // 2. Register metadata with our API (tiny JSON body).
        const upRes = await withRetry(
          () =>
            fetch("/analyze/v2/api/uploads", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                blobUrl: blob.url,
                filename: item.file.name,
                fileSize: item.file.size,
                metadata: meta,
              }),
            }).then((r) => {
              if (!r.ok) {
                throw new Error(`register ${r.status}`);
              }
              return r;
            }),
          "register-metadata"
        );
        const { videoId } = (await upRes.json()) as { videoId: string };
        patch(item.id, { state: "analyzing", videoId });

        const jobRes = await withRetry(
          () =>
            fetch("/analyze/v2/api/jobs", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ videoId }),
            }).then((r) => {
              if (!r.ok) {
                throw new Error(`job ${r.status}`);
              }
              return r;
            }),
          "start-job"
        );
        const { jobId } = (await jobRes.json()) as { jobId: string };
        patch(item.id, { analysisId: jobId });

        await pollJob(item.id, jobId);
      } catch (err) {
        patch(item.id, {
          state: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      } finally {
        activeRef.current--;
        pumpRef.current();
      }
    },
    [patch, pollJob]
  );

  const pump = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        if (item.state === "queued" && activeRef.current < MAX_CONCURRENT) {
          activeRef.current++;
          runOne(item).catch(() => {
            /* runOne handles its own errors via patch() */
          });
        }
      }
      return prev;
    });
  }, [runOne]);

  pumpRef.current = pump;

  const enqueue = useCallback(
    (files: File[]) => {
      const newItems: QueueItem[] = files.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        state: "queued",
      }));
      setItems((prev) => [...prev, ...newItems]);
      queueMicrotask(pump);
    },
    [pump]
  );

  return { items, enqueue };
}
