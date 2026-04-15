"use client";

import { useCallback, useState } from "react";
import type { AudioAnalysis } from "@/lib/video/audio-schema";
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
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysis | null>(
    null
  );
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
        setProgress(p * 0.45);
      });

      setExtraction(result);

      setState("analyzing");
      setStep("Running AI analysis");
      setProgress(0.5);

      // Fire visual (Qwen) and audio (Gemini) analyses in parallel.
      const { uploadAudioWav, uploadFramesBundle } = await import(
        "@/lib/video/blob-upload"
      );

      const qwenPromise = (async () => {
        const framesUrl = await uploadFramesBundle(result.frames);
        const res = await fetch("/analyze/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extraction: {
              ...result,
              frames: result.frames.map((f) => ({
                timestamp: f.timestamp,
                brightness: f.brightness,
                dominantColor: f.dominantColor,
                dataUrl: "",
              })),
            },
            framesUrl,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Visual analysis HTTP ${res.status}`);
        }
        const { analysis: qwen } = (await res.json()) as {
          analysis: QwenAnalysis;
        };
        return qwen;
      })();

      const audioPromise = (async () => {
        const { encodeVideoAudioToWav } = await import(
          "@/lib/video/audio-extract"
        );
        const wav = await encodeVideoAudioToWav(file);
        const audioUrl = await uploadAudioWav(wav);
        const res = await fetch("/analyze/api/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioUrl }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Audio analysis HTTP ${res.status}`);
        }
        const { analysis: audio } = (await res.json()) as {
          analysis: AudioAnalysis;
        };
        return audio;
      })();

      const [qwenResult, audioResult] = await Promise.allSettled([
        qwenPromise,
        audioPromise,
      ]);

      if (qwenResult.status === "fulfilled") {
        setAnalysis(qwenResult.value);
      } else {
        console.warn("[useVideoProcessor] Qwen failed:", qwenResult.reason);
      }
      if (audioResult.status === "fulfilled") {
        setAudioAnalysis(audioResult.value);
      } else {
        console.warn("[useVideoProcessor] audio failed:", audioResult.reason);
      }

      const errors: string[] = [];
      if (qwenResult.status === "rejected") {
        errors.push(
          `Visual: ${qwenResult.reason instanceof Error ? qwenResult.reason.message : String(qwenResult.reason)}`
        );
      }
      if (audioResult.status === "rejected") {
        errors.push(
          `Audio: ${audioResult.reason instanceof Error ? audioResult.reason.message : String(audioResult.reason)}`
        );
      }
      if (errors.length > 0) {
        setError(errors.join(" · "));
      }

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
    setExtraction(null);
    setAnalysis(null);
    setAudioAnalysis(null);
    setError(null);
  }, []);

  return {
    state,
    progress,
    step,
    extraction,
    analysis,
    audioAnalysis,
    error,
    processVideo,
    reset,
    steps: STEPS,
  };
}
