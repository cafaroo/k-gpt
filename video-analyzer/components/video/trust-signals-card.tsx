"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  trustSignals: AnalysisExtended["trustSignals"];
  onSeek?: (time: number) => void;
};

export function TrustSignalsCard({ trustSignals, onSeek }: Props) {
  if (trustSignals.length === 0) {
    return null;
  }

  const sorted = [...trustSignals].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Trust signals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((t) => (
          <div
            className="flex items-start gap-3 rounded-md border bg-muted/20 p-2"
            key={`ts-${t.timestamp}-${t.type}`}
          >
            <button
              className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-xs"
              onClick={() => onSeek?.(t.timestamp)}
              type="button"
            >
              {t.timestamp.toFixed(1)}s
            </button>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/15 text-emerald-600 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {t.type}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  strength {t.strength.toFixed(1)}/10
                </span>
              </div>
              <p className="text-xs leading-snug">{t.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
