"use client";

import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
};

const PRIORITY_META = {
  high: {
    icon: AlertTriangle,
    color: "text-red-500",
    border: "border-l-red-500",
    label: "High priority",
  },
  medium: {
    icon: Info,
    color: "text-amber-500",
    border: "border-l-amber-500",
    label: "Medium",
  },
  low: {
    icon: Sparkles,
    color: "text-sky-500",
    border: "border-l-sky-500",
    label: "Low",
  },
} as const;

export function Recommendations({ analysis }: Props) {
  const sorted = [...analysis.recommendations].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  if (sorted.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((r) => {
          const meta = PRIORITY_META[r.priority];
          const Icon = meta.icon;
          return (
            <div
              className={`rounded-md border border-l-4 ${meta.border} bg-muted/30 p-3`}
              key={`${r.area}-${r.issue}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {r.area}
                    </span>
                    <span className={`text-[10px] font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{r.issue}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    <span className="font-medium">Fix: </span>
                    {r.suggestion}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs italic">
                    Expected impact: {r.expectedImpact}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
