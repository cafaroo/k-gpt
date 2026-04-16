"use client";

import { useCallback, useState } from "react";
import { runAnalyzeJob } from "@/lib/video/analyze-client";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";
import type {
  ProcessingState,
  VideoExtraction,
  VideoMetadata,
} from "@/lib/video/types";

const STEPS = [
  "Loading video",
  "Uploading",
  "Running AI analysis",
  "Ready",
] as const;

export function useVideoProcessor() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<string>("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QwenAnalysis | null>(null);
  const [extraction, setExtraction] = useState<VideoExtraction | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processVideo = useCallback(async (file: File) => {
    try {
      setError(null);
      setExtractionError(null);
      setState("loading");
      setStep("Loading video");
      setProgress(0.05);

      const { readMetadata } = await import("@/lib/video/extractors");
      const meta = await readMetadata(file);
      setMetadata(meta);

      const extractPromise = import("@/lib/video/extractors")
        .then(({ extractAll }) => extractAll(file))
        .then((ex) => {
          setExtraction(ex);
          return ex;
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[useVideoProcessor] extractAll failed:", err);
          setExtractionError(msg);
          return null;
        });

      setStep("Uploading");
      setProgress(0.2);
      const { uploadVideo } = await import("@/lib/video/blob-upload");
      const url = await uploadVideo(file);
      setVideoUrl(url);
      console.log("[useVideoProcessor] video uploaded:", url);

      setState("analyzing");
      setStep("Running AI analysis");
      setProgress(0.4);

      const result = await runAnalyzeJob(
        { metadata: meta, videoUrl: url },
        {
          onProgress: (frac) => setProgress(0.4 + frac * 0.5),
        }
      );
      setAnalysis(result);

      await extractPromise;

      setProgress(1);
      setState("done");
      setStep("Ready");
    } catch (err) {
      console.error("[useVideoProcessor]", err);
      setError(err instanceof Error ? err.message : "Processing failed");
      setState("error");
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setProgress(0);
    setStep("");
    setMetadata(null);
    setVideoUrl(null);
    setAnalysis(null);
    setExtraction(null);
    setExtractionError(null);
    setError(null);
  }, []);

  return {
    state,
    progress,
    step,
    metadata,
    videoUrl,
    analysis,
    extraction,
    extractionError,
    error,
    processVideo,
    reset,
    steps: STEPS,
  };
}
