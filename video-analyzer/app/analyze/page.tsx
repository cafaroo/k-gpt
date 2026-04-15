"use client";

import { useState } from "react";
import { ExtractionProgress } from "@/components/video/extraction-progress";
import { QwenDashboard } from "@/components/video/qwen-dashboard";
import { VideoUpload } from "@/components/video/video-upload";
import { useVideoProcessor } from "@/hooks/use-video-processor";

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const processor = useVideoProcessor();

  const handleFile = (f: File) => {
    setFile(f);
    processor.processVideo(f);
  };

  const handleReset = () => {
    setFile(null);
    processor.reset();
  };

  if (processor.state === "done" && processor.extraction && file) {
    return (
      <QwenDashboard
        analysis={processor.analysis}
        analysisError={processor.error}
        audioAnalysis={processor.audioAnalysis}
        extraction={processor.extraction}
        file={file}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Analyze a short-form video
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Upload a TikTok-style video and get a deep AI analysis of hook,
          pacing, CTA, and more — powered by Qwen3 VL Thinking.
        </p>
      </div>

      {processor.state === "idle" && <VideoUpload onFile={handleFile} />}

      {(processor.state === "loading" ||
        processor.state === "extracting" ||
        processor.state === "analyzing" ||
        processor.state === "error") && (
        <ExtractionProgress
          currentStep={processor.step}
          error={processor.error}
          progress={processor.progress}
          steps={processor.steps}
        />
      )}

      {processor.state === "error" && (
        <button
          className="text-primary text-sm underline"
          onClick={handleReset}
          type="button"
        >
          Try another video
        </button>
      )}
    </div>
  );
}
