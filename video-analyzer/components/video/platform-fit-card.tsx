"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  platformFit: AnalysisExtended["platformFit"];
};

const LABELS: Record<
  keyof Omit<AnalysisExtended["platformFit"], "bestFit" | "notes">,
  string
> = {
  tiktok: "TikTok",
  reels: "Reels",
  youtubeShorts: "YouTube Shorts",
};

const BEST_FIT_TO_KEY: Record<
  AnalysisExtended["platformFit"]["bestFit"],
  keyof typeof LABELS | "all"
> = {
  tiktok: "tiktok",
  reels: "reels",
  "youtube-shorts": "youtubeShorts",
  "all-equal": "all",
};

function getScoreColor(score: number): string {
  if (score >= 7.5) {
    return "text-emerald-500";
  }
  if (score >= 5) {
    return "text-amber-500";
  }
  return "text-red-500";
}

export function PlatformFitCard({ platformFit }: Props) {
  const bestKey = BEST_FIT_TO_KEY[platformFit.bestFit];
  const platforms: (keyof typeof LABELS)[] = [
    "tiktok",
    "reels",
    "youtubeShorts",
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Platform fit</CardTitle>
        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
          Best: {bestKey === "all" ? "all equal" : LABELS[bestKey]}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {platforms.map((p) => {
            const entry = platformFit[p];
            const highlighted = bestKey === p;
            return (
              <div
                className={`rounded-md border p-2 ${highlighted ? "border-primary" : ""}`}
                key={p}
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                    {LABELS[p]}
                  </span>
                  <span
                    className={`text-lg font-semibold ${getScoreColor(entry.score)}`}
                  >
                    {entry.score.toFixed(1)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-3 text-[11px] leading-snug">
                  {entry.reasoning}
                </p>
              </div>
            );
          })}
        </div>
        {platformFit.notes && (
          <p className="text-muted-foreground text-xs italic">
            {platformFit.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
