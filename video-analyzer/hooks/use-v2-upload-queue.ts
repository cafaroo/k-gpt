"use client";
import { useCallback, useRef, useState } from "react";

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

async function probeMetadata(file: File): Promise<{
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
        if (!res.ok) continue;
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

        const form = new FormData();
        form.append("file", item.file);
        form.append("metadata", JSON.stringify(meta));
        const upRes = await fetch("/analyze/v2/api/uploads", {
          method: "POST",
          body: form,
        });
        if (!upRes.ok) throw new Error("upload failed");
        const { videoId } = (await upRes.json()) as { videoId: string };
        patch(item.id, { state: "analyzing", videoId });

        const jobRes = await fetch("/analyze/v2/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ videoId }),
        });
        if (!jobRes.ok) throw new Error("job start failed");
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
        pump();
      }
    },
    [patch, pollJob]
  );

  const pump = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        if (item.state === "queued" && activeRef.current < MAX_CONCURRENT) {
          activeRef.current++;
          void runOne(item);
        }
      }
      return prev;
    });
  }, [runOne]);

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
