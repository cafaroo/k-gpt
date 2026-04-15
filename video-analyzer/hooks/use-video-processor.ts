"use client";

import { useCallback, useState } from "react";
import type { ProcessingState, VideoExtraction } from "@/lib/video/types";

const STEPS = [
  "Loading ffmpeg",
  "Extracting frames",
  "Motion & scenes analyzed",
  "Extracting audio",
  "Ready",
] as const;

export function useVideoProcessor() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<string>("");
  const [extraction, setExtraction] = useState<VideoExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processVideo = useCallback(async (file: File) => {
    try {
      setError(null);
      setState("loading");
      setStep("Loading ffmpeg");
      setProgress(0);

      const { initFFmpeg } = await import("@/lib/video/ffmpeg-worker");
      await initFFmpeg((_msg, p) => {
        setProgress(p * 0.1);
      });

      setState("extracting");
      const { extractAll } = await import("@/lib/video/extractors");
      const result = await extractAll(file, (stepName, p) => {
        setStep(stepName);
        setProgress(0.1 + p * 0.9);
      });

      setExtraction(result);
      setState("done");
      setProgress(1);
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
    setExtraction(null);
    setError(null);
  }, []);

  return {
    state,
    progress,
    step,
    extraction,
    error,
    processVideo,
    reset,
    steps: STEPS,
  };
}
