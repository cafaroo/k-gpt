"use client";

import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { topPerformers } from "@/lib/video/batch/insights";
import type { VideoJob } from "@/lib/video/batch/types";

type Props = {
  videos: VideoJob[];
  onPick: (id: string) => void;
};

const RANK_COLOR = ["text-amber-500", "text-slate-400", "text-orange-700"];

export function BatchWinnersCard({ videos, onPick }: Props) {
  const winners = topPerformers(videos, 3);
  if (winners.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Trophy className="text-amber-500 h-4 w-4" />
          Top performers
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {winners.map((v, idx) => (
          <button
            className="group flex flex-col gap-2 overflow-hidden rounded-lg border transition-all hover:border-primary/60 hover:shadow-md"
            key={v.id}
            onClick={() => onPick(v.id)}
            type="button"
          >
            <div className="bg-muted relative aspect-[9/16] overflow-hidden">
              {v.thumbnailDataUrl && (
                // biome-ignore lint/performance/noImgElement: data URL
                <img
                  alt={v.filename}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  src={v.thumbnailDataUrl}
                />
              )}
              <div
                className={`absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold ${RANK_COLOR[idx]}`}
              >
                #{idx + 1}
              </div>
              <div className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">
                {v.qwen?.overall.score.toFixed(0)}
              </div>
            </div>
            <div className="p-2 text-left">
              <p className="truncate text-xs font-medium">{v.filename}</p>
              <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
                {v.qwen?.overall.tagline}
              </p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
