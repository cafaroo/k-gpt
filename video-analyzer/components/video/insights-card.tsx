"use client";

import { AlertCircle, CheckCircle2, MinusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
};

const IMPACT_META = {
  positive: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    border: "border-l-emerald-500",
    label: "Positive",
  },
  neutral: {
    icon: MinusCircle,
    color: "text-slate-500",
    border: "border-l-slate-400",
    label: "Neutral",
  },
  negative: {
    icon: AlertCircle,
    color: "text-red-500",
    border: "border-l-red-500",
    label: "Risk",
  },
} as const;

export function InsightsCard({ analysis }: Props) {
  const insights = analysis.insights ?? [];
  if (insights.length === 0) {
    return null;
  }

  const sorted = [...insights].sort((a, b) => {
    const order = { negative: 0, positive: 1, neutral: 2 } as const;
    return order[a.impact] - order[b.impact];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((ins) => {
          const meta = IMPACT_META[ins.impact] ?? IMPACT_META.neutral;
          const Icon = meta.icon;
          return (
            <div
              className={`rounded-md border border-l-4 ${meta.border} bg-muted/30 p-3`}
              key={`${ins.area}-${ins.observation.slice(0, 32)}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {ins.area}
                    </span>
                    <span className={`text-[10px] font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium leading-snug">
                    {ins.observation}
                  </p>
                  {ins.evidence && (
                    <p className="text-muted-foreground mt-1 text-xs italic leading-snug">
                      {ins.evidence}
                    </p>
                  )}
                  {ins.note && (
                    <p className="text-muted-foreground mt-1 text-xs leading-snug">
                      {ins.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
