"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type Props = {
  sequence: string[];
  matchScore: number;
  matched: string[];
  rationale?: string;
};

function scoreColor(score: number): string {
  if (score >= 7) {
    return "#10b981";
  }
  if (score >= 4) {
    return "#f59e0b";
  }
  return "#ef4444";
}

function pillColor(emotion: string): string {
  const map: Record<string, string> = {
    frustration: "#ef4444",
    problem: "#ef4444",
    pain: "#ef4444",
    anger: "#ef4444",
    fear: "#ef4444",
    hope: "#3b82f6",
    curiosity: "#3b82f6",
    interest: "#3b82f6",
    anticipation: "#6366f1",
    excitement: "#f59e0b",
    joy: "#10b981",
    resolution: "#10b981",
    trust: "#10b981",
    satisfaction: "#10b981",
    empathy: "#a855f7",
    surprise: "#06b6d4",
    disgust: "#64748b",
    sadness: "#8b5cf6",
    relief: "#10b981",
    inspiration: "#f59e0b",
  };
  return map[emotion.toLowerCase()] ?? "#6b7280";
}

export function EmotionalFlowDiagram({
  sequence,
  matchScore,
  matched,
  rationale,
}: Props) {
  const color = scoreColor(matchScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Emotional Flow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {sequence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No emotional flow sequence available.
          </p>
        ) : (
          <>
            {/* Sequence pills + arrows */}
            <div className="flex flex-wrap items-center gap-1.5">
              {sequence.map((emotion, i) => {
                const c = pillColor(emotion);
                return (
                  <div
                    className="flex items-center gap-1.5"
                    key={`${emotion}-${i}`}
                  >
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                      style={{
                        background: `${c}25`,
                        color: c,
                        border: `1px solid ${c}55`,
                      }}
                    >
                      {emotion}
                    </span>
                    {i < sequence.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Match score */}
            <div className="flex items-end gap-3">
              <div>
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Pattern match score
                  <InfoTooltip metricKey="emotionalFlowMatchScore" side="top" />
                </div>
                <div
                  className="text-4xl font-bold tabular-nums"
                  style={{ color }}
                >
                  {matchScore.toFixed(1)}
                  <span className="text-base font-normal text-muted-foreground ml-1">
                    /10
                  </span>
                </div>
              </div>
              <div className="flex-1 pb-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(matchScore / 10) * 100}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Matched patterns */}
            {matched.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Matched patterns
                </div>
                <div className="flex flex-wrap gap-2">
                  {matched.map((pattern, i) => (
                    <span
                      className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600"
                      key={`${pattern}-${i}`}
                    >
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                No high-performing pattern matched. Distinct emotions:{" "}
                {new Set(sequence).size}.
              </div>
            )}

            {/* Rationale */}
            {rationale && (
              <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-muted pl-3">
                {rationale}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
