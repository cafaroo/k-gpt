"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  patternInterrupts: AnalysisExtended["patternInterrupts"];
  onSeek?: (time: number) => void;
};

export function PatternInterruptsCard({ patternInterrupts, onSeek }: Props) {
  if (patternInterrupts.length === 0) {
    return null;
  }

  const sorted = [...patternInterrupts].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Pattern interrupts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((p) => (
          <div
            className="flex items-start gap-3 rounded-md border bg-muted/20 p-2"
            key={`pi-${p.timestamp}-${p.type}`}
          >
            <button
              className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-xs"
              onClick={() => onSeek?.(p.timestamp)}
              type="button"
            >
              {p.timestamp.toFixed(1)}s
            </button>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/15 text-blue-600 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {p.type}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  effect {p.effectiveness.toFixed(1)}/10
                </span>
              </div>
              <p className="text-xs leading-snug">{p.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
