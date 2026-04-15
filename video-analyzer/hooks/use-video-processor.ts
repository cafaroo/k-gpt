"use client";

import { useCallback, useState } from "react";
import type { ProcessingState, VideoExtraction } from "@/lib/video/types";

const STEPS = [
  "Loading video",
  "Extracting frames",
  "Motion & scenes analyzed",
  "Audio analyzed",
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
      setStep("Loading video");
      setProgress(0);

      setState("extracting");
      const { extractAll } = await import("@/lib/video/extractors");
      const result = await extractAll(file, (stepName, p) => {
        setStep(stepName);
        setProgress(p);
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
