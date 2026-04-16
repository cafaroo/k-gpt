"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  microMoments: AnalysisExtended["microMoments"];
  onSeek?: (time: number) => void;
};

const IMPACT_STYLE: Record<
  AnalysisExtended["microMoments"][number]["impactOnRetention"],
  string
> = {
  "very-positive": "bg-emerald-500/15 text-emerald-600",
  positive: "bg-emerald-500/10 text-emerald-500",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-red-500/15 text-red-600",
};

export function MicroMomentsCard({ microMoments, onSeek }: Props) {
  if (microMoments.length === 0) {
    return null;
  }

  const sorted = [...microMoments].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Micro-moments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((m) => (
          <div
            className="flex items-start gap-3 rounded-md border bg-muted/20 p-2"
            key={`mm-${m.timestamp}-${m.kind}`}
          >
            <button
              className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-xs"
              onClick={() => onSeek?.(m.timestamp)}
              type="button"
            >
              {m.timestamp.toFixed(1)}s
            </button>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {m.kind}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${IMPACT_STYLE[m.impactOnRetention]}`}
                >
                  {m.impactOnRetention}
                </span>
              </div>
              <p className="text-xs leading-snug">{m.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
