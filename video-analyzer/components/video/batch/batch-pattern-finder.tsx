"use client";

import { Lightbulb, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeBatchInsights } from "@/lib/video/batch/insights";
import type { BatchInsight, VideoJob } from "@/lib/video/batch/types";

type Props = {
  videos: VideoJob[];
  hasPerformanceData: boolean;
};

const KIND_COLORS: Record<BatchInsight["kind"], string> = {
  "hook-style-performance": "border-l-red-500",
  "cta-timing": "border-l-pink-500",
  "pacing-correlation": "border-l-amber-500",
  "niche-playbook": "border-l-blue-500",
  "rule-compliance": "border-l-emerald-500",
  "text-overlay": "border-l-purple-500",
  "audio-mood": "border-l-cyan-500",
  "structural-distribution": "border-l-slate-400",
};

export function BatchPatternFinder({ videos, hasPerformanceData }: Props) {
  const insights = computeBatchInsights(videos);
  if (insights.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="text-primary h-4 w-4" />
          Pattern finder
        </CardTitle>
        <span className="text-muted-foreground text-xs">
          {hasPerformanceData
            ? "Correlating creative with performance data"
            : "Structural patterns (upload CSV for performance correlation)"}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((i) => (
          <div
            className={`rounded-md border border-l-4 ${KIND_COLORS[i.kind]} bg-muted/30 p-3`}
            key={i.id}
          >
            <div className="flex items-start gap-2">
              <TrendingUp className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {i.title}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    confidence {(i.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-sm leading-snug">{i.finding}</p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Based on {i.videoIds.length} video
                  {i.videoIds.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
