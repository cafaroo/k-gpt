"use client";

import { AlertCircle, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  QwenAnalysis,
  QwenAnalysisWithExtended,
} from "@/lib/video/qwen-schema";
import type {
  ExportChartRefs,
  PerformanceData,
  VideoExtraction,
} from "@/lib/video/types";
import { AnalysisChat } from "./analysis-chat";
import { AudioChart } from "./audio-chart";
import { AudioInsightsV2 } from "./audio-insights-v2";
import { BeatMapStrip } from "./beat-map-strip";
import { EmotionalArcChart } from "./emotional-arc-chart";
import { ExportButton } from "./export-button";
import { FrameGallery } from "./frame-gallery";
import { HeroScorecards, OverallSummary } from "./hero-scorecards";
import { HookDissectionCard } from "./hook-dissection-card";
import { InsightsCard } from "./insights-card";
import { MetricsInput } from "./metrics-input";
import { MicroMomentsCard } from "./micro-moments-card";
import { PacingCurve } from "./pacing-curve";
import { PatternInterruptsCard } from "./pattern-interrupts-card";
import { PlatformFitCard } from "./platform-fit-card";
import {
  NichePlaybookCard,
  PerformancePredictionCard,
  RuleComplianceCard,
} from "./rule-compliance";
import { SceneNarrative } from "./scene-narrative";
import { SwipeRiskCurve } from "./swipe-risk-curve";
import { Timeline } from "./timeline";
import { TranscriptCard } from "./transcript-card";
import { TrustSignalsCard } from "./trust-signals-card";
import { VideoPlayer, type VideoPlayerHandle } from "./video-player";

type Props = {
  file: File;
  extraction: VideoExtraction;
  analysis: QwenAnalysisWithExtended | null;
  analysisError?: string | null;
  extractionError?: string | null;
  onReset: () => void;
};

export function QwenDashboard({
  file,
  extraction,
  analysis,
  analysisError,
  extractionError,
  onReset,
}: Props) {
  const videoRef = useRef<VideoPlayerHandle>(null);
  const audioChartRef = useRef<HTMLDivElement>(null);
  const pacingCurveRef = useRef<HTMLDivElement>(null);
  const [timelineEl, setTimelineEl] = useState<HTMLDivElement | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [performance, setPerformance] = useState<PerformanceData>({});

  // Create the blob URL once per file. Using useMemo + an unmount-only
  // revoke avoids React Strict Mode running the cleanup between mount and
  // paint (which caused ERR_FILE_NOT_FOUND when <video src=...> tried to
  // load a URL that had already been revoked).
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(src);
    };
  }, [src]);

  const chartRefs: ExportChartRefs = {
    audio: audioChartRef.current,
    timeline: timelineEl,
    pacing: pacingCurveRef.current,
  };

  const { metadata, sceneChanges, motionSegments, frames } = extraction;

  const seek = (t: number) => videoRef.current?.seek(t);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{metadata.filename}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {metadata.duration.toFixed(1)}s · {metadata.width}×{metadata.height}{" "}
            · {metadata.aspectRatio} ·{" "}
            {(metadata.fileSize / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            analysis={{
              extraction,
              performance,
              qwenAnalysis: analysis,
            }}
            chartRefs={chartRefs}
          />
          <Button onClick={onReset} size="sm" variant="outline">
            New video
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm">
                <MessageSquare className="mr-2 h-4 w-4" />
                Prata med videon
              </Button>
            </SheetTrigger>
            <SheetContent
              className="flex w-full flex-col p-0 sm:max-w-lg"
              side="right"
            >
              <SheetHeader className="border-b p-4">
                <SheetTitle>Chat about this video</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <AnalysisChat
                  extraction={extraction}
                  performance={performance}
                  qwenAnalysis={analysis}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Analysis error banner */}
      {analysisError && !analysis && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1">
              <p className="font-medium">Qwen analysis unavailable</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {analysisError}. Extraction data is still available below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction error banner */}
      {extractionError && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium">Client-side extraction failed</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {extractionError}. Frames, audio RMS and motion analysis won't
                render — the Qwen analysis above is unaffected.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Qwen analysis section */}
      {analysis ? (
        <>
          <HeroScorecards analysis={analysis} />
          <OverallSummary analysis={analysis} />

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Left: video + scene */}
            <div className="space-y-4">
              <VideoPlayer
                onTimeUpdate={setCurrentTime}
                ref={videoRef}
                src={src}
              />
              <Timeline
                currentTime={currentTime}
                extraction={extraction}
                onElementReady={setTimelineEl}
                onSeek={seek}
              />
              <FrameGallery
                currentTime={currentTime}
                frames={frames}
                onSeek={seek}
              />
              <BeatMapStrip
                analysis={analysis}
                duration={metadata.duration}
                onSeek={seek}
              />
              <SceneNarrative
                analysis={analysis}
                duration={metadata.duration}
                onSeek={seek}
              />
            </div>

            {/* Right: pacing + predictions + rules + insights */}
            <div className="space-y-4">
              <PerformancePredictionCard analysis={analysis} />
              <PacingCurve analysis={analysis} ref={pacingCurveRef} />
              <InsightsCard analysis={analysis} />
              <RuleComplianceCard analysis={analysis} />
              <NichePlaybookCard analysis={analysis} />
              <DetailCards analysis={analysis} />
            </div>
          </div>

          {/* Extended analysis sections — populated on second Gemini pass */}
          {analysis.extended && (
            <ExtendedSections extended={analysis.extended} onSeek={seek} />
          )}
          {!analysis.extended && analysis.extendedError && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-start gap-3 py-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="flex-1">
                  <p className="font-medium">Extended analysis unavailable</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {analysis.extendedError}. Core analysis shown above — retry
                    by uploading the video again for full insights (transcript,
                    swipe-risk, emotional arc, etc.).
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        // No analysis yet (error/loading): show at least video + raw data
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <VideoPlayer
              onTimeUpdate={setCurrentTime}
              ref={videoRef}
              src={src}
            />
            <Timeline
              currentTime={currentTime}
              extraction={extraction}
              onElementReady={setTimelineEl}
              onSeek={seek}
            />
            <FrameGallery
              currentTime={currentTime}
              frames={frames}
              onSeek={seek}
            />
          </div>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              <p className="text-sm">AI analysis in progress…</p>
            </div>
          </div>
        </div>
      )}

      {/* Raw extraction data (collapsed by default — separate Tabs below) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Raw extraction data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="audio">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="audio">Audio RMS</TabsTrigger>
              <TabsTrigger value="motion">Motion</TabsTrigger>
              <TabsTrigger value="metrics">Performance</TabsTrigger>
              <TabsTrigger value="stats">Metadata</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-3" value="audio">
              <AudioChart
                ref={audioChartRef}
                segments={extraction.audioSegments}
              />
            </TabsContent>

            <TabsContent className="mt-3" value="motion">
              <div className="max-h-[28rem] overflow-y-auto">
                {motionSegments.length === 0 ? (
                  <div className="text-muted-foreground rounded-lg border p-4 text-center text-xs">
                    <p className="font-medium">No motion data available</p>
                    <p className="mt-1 text-[11px] opacity-70">
                      Motion analysis runs on sampled frames — extraction likely
                      failed before producing any samples. Check the browser
                      console for extractAll warnings.
                    </p>
                  </div>
                ) : (
                  <ul className="text-sm">
                    {motionSegments.map((m) => (
                      <li
                        className="flex items-center justify-between border-b py-1 last:border-0"
                        key={`${m.startTime}-${m.endTime}`}
                      >
                        <span>
                          {m.startTime.toFixed(1)}–{m.endTime.toFixed(1)}s
                        </span>
                        <span className="text-muted-foreground">
                          {m.interpretation} ({m.motionScore})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent className="mt-3" value="metrics">
              <MetricsInput
                onChange={(patch) =>
                  setPerformance((prev) => ({ ...prev, ...patch }))
                }
                value={performance}
              />
            </TabsContent>

            <TabsContent className="mt-3" value="stats">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Row label="Filename" value={metadata.filename} />
                <Row
                  label="Duration"
                  value={`${metadata.duration.toFixed(2)}s`}
                />
                <Row
                  label="Resolution"
                  value={`${metadata.width}×${metadata.height}`}
                />
                <Row label="Aspect" value={metadata.aspectRatio} />
                <Row
                  label="Size"
                  value={`${(metadata.fileSize / 1024 / 1024).toFixed(1)} MB`}
                />
                <Row
                  label="Bitrate"
                  value={`${Math.round(metadata.bitrate / 1000)} kbps`}
                />
                <Row label="Scenes" value={String(sceneChanges.length)} />
                <Row label="Frames" value={String(frames.length)} />
              </dl>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ExtendedSections({
  extended,
  onSeek,
}: {
  extended: NonNullable<QwenAnalysisWithExtended["extended"]>;
  onSeek: (t: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <HookDissectionCard
          hookDissection={extended.hookDissection}
          onSeek={onSeek}
        />
        <TranscriptCard onSeek={onSeek} transcript={extended.transcript} />
      </div>

      <AudioInsightsV2 audioExtended={extended.audioExtended} onSeek={onSeek} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SwipeRiskCurve swipeRiskCurve={extended.swipeRiskCurve} />
        <EmotionalArcChart
          emotionalArc={extended.emotionalArc}
          onSeek={onSeek}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PatternInterruptsCard
          onSeek={onSeek}
          patternInterrupts={extended.patternInterrupts}
        />
        <TrustSignalsCard
          onSeek={onSeek}
          trustSignals={extended.trustSignals}
        />
        <MicroMomentsCard
          microMoments={extended.microMoments}
          onSeek={onSeek}
        />
      </div>

      <PlatformFitCard platformFit={extended.platformFit} />
    </div>
  );
}

function DetailCards({ analysis }: { analysis: QwenAnalysis }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hook deep-dive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">{analysis.hook.rationale}</p>
          {analysis.hook.elements.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {analysis.hook.elements.map((el) => (
                <span
                  className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                  key={el}
                >
                  {el}
                </span>
              ))}
            </div>
          )}
          {analysis.hook.improvements.length > 0 && (
            <ul className="text-muted-foreground mt-2 list-disc pl-5 text-xs">
              {analysis.hook.improvements.map((imp) => (
                <li key={imp}>{imp}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audio insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex gap-4 text-xs">
            <span>
              Voiceover:{" "}
              <strong>{analysis.audio.hasVoiceover ? "yes" : "no"}</strong>
            </span>
            <span>
              Music: <strong>{analysis.audio.hasMusic ? "yes" : "no"}</strong>
            </span>
            {analysis.audio.musicEnergy && (
              <span>
                Energy: <strong>{analysis.audio.musicEnergy}</strong>
              </span>
            )}
          </div>
          {analysis.audio.voiceoverSummary && (
            <p className="text-muted-foreground text-xs italic">
              "{analysis.audio.voiceoverSummary}"
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {analysis.audio.audioNotes}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Target audience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Age: </span>
            <strong>{analysis.targetAudience.ageRange}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Buyer stage: </span>
            <strong>{analysis.targetAudience.buyerStage}</strong>
          </p>
          {analysis.targetAudience.interests.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {analysis.targetAudience.interests.map((i) => (
                <span
                  className="bg-muted rounded-full px-2 py-0.5 text-xs"
                  key={i}
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Visual style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="bg-muted rounded-full px-2 py-0.5">
              variety <strong>{analysis.visual.variety}/10</strong>
            </span>
            <span className="bg-muted rounded-full px-2 py-0.5">
              text overlays: {analysis.visual.textOverlayUsage}
            </span>
            <span className="bg-muted rounded-full px-2 py-0.5">
              camera: {analysis.visual.cameraMovement}
            </span>
            <span className="bg-muted rounded-full px-2 py-0.5">
              branding: {analysis.visual.brandingVisibility}
            </span>
            <span className="bg-muted rounded-full px-2 py-0.5">
              face: {Math.round(analysis.visual.dominantFaceRatio * 100)}%
            </span>
          </div>
          {analysis.visual.details && (
            <p className="leading-relaxed">{analysis.visual.details}</p>
          )}
          {analysis.visual.mood && !analysis.visual.details && (
            <p className="text-muted-foreground">{analysis.visual.mood}</p>
          )}
          {analysis.visual.shotTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-muted-foreground text-xs">Shots:</span>
              {analysis.visual.shotTypes.map((s) => (
                <span
                  className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                  key={s}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          {analysis.visual.dominantColors.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">Colors:</span>
              {analysis.visual.dominantColors.map((c) => (
                <div
                  className="h-5 w-5 rounded border"
                  key={c}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </>
  );
}
