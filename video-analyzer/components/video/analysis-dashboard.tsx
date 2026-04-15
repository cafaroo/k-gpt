"use client";

import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  ExportChartRefs,
  PerformanceData,
  VideoExtraction,
} from "@/lib/video/types";
import { AnalysisChat } from "./analysis-chat";
import { AudioChart } from "./audio-chart";
import { ExportButton } from "./export-button";
import { FrameGallery } from "./frame-gallery";
import { MetricsInput } from "./metrics-input";
import { Timeline } from "./timeline";
import { VideoPlayer, type VideoPlayerHandle } from "./video-player";

type Props = {
  file: File;
  extraction: VideoExtraction;
  onReset: () => void;
};

export function AnalysisDashboard({ file, extraction, onReset }: Props) {
  const videoRef = useRef<VideoPlayerHandle>(null);
  const audioChartRef = useRef<HTMLDivElement>(null);
  const [timelineEl, setTimelineEl] = useState<HTMLDivElement | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [performance, setPerformance] = useState<PerformanceData>({});

  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chartRefs: ExportChartRefs = {
    audio: audioChartRef.current,
    timeline: timelineEl,
  };

  const { metadata, sceneChanges, motionSegments, frames } = extraction;
  const avgMotion = motionSegments.length
    ? Math.round(
        motionSegments.reduce((s, m) => s + m.motionScore, 0) /
          motionSegments.length
      )
    : 0;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Left column */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Analysis</h1>
            <p className="text-muted-foreground text-sm">{metadata.filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              analysis={{ extraction, performance }}
              chartRefs={chartRefs}
            />
            <Button onClick={onReset} size="sm" variant="outline">
              New video
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Ask Claude
                </Button>
              </SheetTrigger>
              <SheetContent
                className="flex w-full flex-col p-0 sm:max-w-lg"
                side="right"
              >
                <SheetHeader className="border-b p-4">
                  <SheetTitle>Video analysis chat</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1">
                  <AnalysisChat
                    extraction={extraction}
                    performance={performance}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <VideoPlayer onTimeUpdate={setCurrentTime} ref={videoRef} src={src} />

        <Timeline
          currentTime={currentTime}
          extraction={extraction}
          onElementReady={setTimelineEl}
          onSeek={(t) => videoRef.current?.seek(t)}
        />

        <FrameGallery
          currentTime={currentTime}
          frames={frames}
          onSeek={(t) => videoRef.current?.seek(t)}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Duration"
            value={`${metadata.duration.toFixed(1)}s`}
          />
          <StatCard
            label="Resolution"
            value={`${metadata.width}×${metadata.height}`}
          />
          <StatCard label="Scenes" value={String(sceneChanges.length)} />
          <StatCard label="Avg motion" value={String(avgMotion)} />
        </div>
      </div>

      {/* Right column */}
      <div>
        <Tabs className="w-full" defaultValue="audio">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="motion">Motion</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-3" value="audio">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Audio loudness (RMS)</CardTitle>
              </CardHeader>
              <CardContent>
                <AudioChart
                  ref={audioChartRef}
                  segments={extraction.audioSegments}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="mt-3" value="motion">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Motion segments</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[28rem] overflow-y-auto">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="mt-3" value="metrics">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Performance data</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricsInput
                  onChange={(patch) =>
                    setPerformance((prev) => ({ ...prev, ...patch }))
                  }
                  value={performance}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="mt-3" value="stats">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Metadata</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
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
