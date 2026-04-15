"use client";

import { useCallback, useState } from "react";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";
import type { ProcessingState, VideoExtraction } from "@/lib/video/types";

const STEPS = [
  "Loading video",
  "Extracting frames",
  "Motion & scenes analyzed",
  "Audio analyzed",
  "Running AI analysis",
  "Ready",
] as const;

export function useVideoProcessor() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<string>("");
  const [extraction, setExtraction] = useState<VideoExtraction | null>(null);
  const [analysis, setAnalysis] = useState<QwenAnalysis | null>(null);
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
        // Extraction occupies 0..0.5 of overall progress
        setProgress(p * 0.5);
      });

      setExtraction(result);

      // Kick off Qwen analysis
      setState("analyzing");
      setStep("Running AI analysis");
      setProgress(0.55);

      try {
        const frameDataUrls = result.frames.map((f) => f.dataUrl);
        const res = await fetch("/analyze/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extraction: {
              ...result,
              // Strip dataUrl/gray32 from inline extraction to reduce payload size;
              // frames are sent separately via frameDataUrls.
              frames: result.frames.map((f) => ({
                timestamp: f.timestamp,
                brightness: f.brightness,
                dominantColor: f.dominantColor,
                dataUrl: "",
              })),
            },
            frameDataUrls,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Analysis failed (HTTP ${res.status})`);
        }

        const { analysis: qwenAnalysis } = (await res.json()) as {
          analysis: QwenAnalysis;
        };
        setAnalysis(qwenAnalysis);
        setProgress(1);
      } catch (analysisErr) {
        // Don't fail the whole run if Qwen crashes; user still gets dashboard
        // with extraction data only.
        console.warn("[useVideoProcessor] Qwen analysis failed:", analysisErr);
        setError(
          analysisErr instanceof Error
            ? `Analysis failed: ${analysisErr.message}`
            : "Analysis failed"
        );
        setProgress(1);
      }

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
    setExtraction(null);
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    state,
    progress,
    step,
    extraction,
    analysis,
    error,
    processVideo,
    reset,
    steps: STEPS,
  };
}
