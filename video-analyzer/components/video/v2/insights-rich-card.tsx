"use client";

import { AlertCircle, CheckCircle2, MinusCircle } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type Insight = {
  area:
    | "hook"
    | "pacing"
    | "visual"
    | "audio"
    | "cta"
    | "copy"
    | "editing"
    | "structure"
    | "retention";
  observation: string;
  evidence: string;
  impact: "positive" | "neutral" | "negative";
  note?: string;
};

type Props = {
  insights: Insight[];
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
    color: "text-slate-400",
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

const ALL_AREAS = [
  "hook",
  "pacing",
  "visual",
  "audio",
  "cta",
  "copy",
  "editing",
  "structure",
  "retention",
] as const;

export function InsightsRichCard({ insights }: Props) {
  const [activeArea, setActiveArea] = useState<string | null>(null);

  if (insights.length === 0) {
    return null;
  }

  const presentAreas = Array.from(new Set(insights.map((i) => i.area)));

  const filtered = activeArea
    ? insights.filter((i) => i.area === activeArea)
    : insights;

  const sorted = [...filtered].sort((a, b) => {
    const order = { negative: 0, positive: 1, neutral: 2 } as const;
    return order[a.impact] - order[b.impact];
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <CardTitle className="text-base">Insights</CardTitle>
            <InfoTooltip metricKey="insights" side="bottom" />
          </div>
          <span className="text-muted-foreground text-xs">
            {filtered.length}/{insights.length}
          </span>
        </div>

        {/* Area filter chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              activeArea
                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                : "bg-primary text-primary-foreground"
            }`}
            onClick={() => setActiveArea(null)}
            type="button"
          >
            All
          </button>
          {ALL_AREAS.filter((a) => presentAreas.includes(a)).map((area) => {
            const count = insights.filter((i) => i.area === area).length;
            const negCount = insights.filter(
              (i) => i.area === area && i.impact === "negative"
            ).length;
            return (
              <button
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  activeArea === area
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                key={area}
                onClick={() => setActiveArea(activeArea === area ? null : area)}
                type="button"
              >
                {area}
                {negCount > 0 && (
                  <span className="ml-1 text-red-400">{negCount}</span>
                )}
                {negCount === 0 && (
                  <span className="text-muted-foreground/60 ml-1">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {sorted.map((ins, i) => {
          const meta = IMPACT_META[ins.impact] ?? IMPACT_META.neutral;
          const Icon = meta.icon;
          return (
            <div
              className={`rounded-md border border-l-4 ${meta.border} bg-muted/20 p-3`}
              // biome-ignore lint/suspicious/noArrayIndexKey: deduplication index
              key={`${ins.area}-${i}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
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
