"use client";

import { Activity, Flame, MousePointerClick, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
};

function getScoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.75) {
    return "text-emerald-500";
  }
  if (pct >= 0.5) {
    return "text-amber-500";
  }
  return "text-red-500";
}

function Scorecard({
  label,
  value,
  max,
  icon,
  sublabel,
}: {
  label: string;
  value: number;
  max: number;
  icon: React.ReactNode;
  sublabel?: string;
}) {
  const color = getScoreColor(value, max);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl font-semibold ${color}`}>
          {value.toFixed(max === 100 ? 0 : 1)}
        </span>
        <span className="text-muted-foreground text-xs">/ {max}</span>
      </div>
      {sublabel && (
        <p className="text-muted-foreground mt-1 text-xs">{sublabel}</p>
      )}
    </Card>
  );
}

export function HeroScorecards({ analysis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Scorecard
        icon={<Activity className="h-4 w-4" />}
        label="Overall"
        max={100}
        sublabel={analysis.overall.tagline}
        value={analysis.overall.score}
      />
      <Scorecard
        icon={<Flame className="h-4 w-4" />}
        label="Hook"
        max={10}
        sublabel={`${analysis.hook.duration.toFixed(1)}s`}
        value={analysis.hook.score}
      />
      <Scorecard
        icon={<Activity className="h-4 w-4" />}
        label="Pacing"
        max={10}
        sublabel={`${analysis.pacing.rhythm} · ${analysis.pacing.cutsPerMinute.toFixed(0)} cpm`}
        value={analysis.pacing.score}
      />
      <Scorecard
        icon={<MousePointerClick className="h-4 w-4" />}
        label="CTA"
        max={10}
        sublabel={analysis.cta.exists ? analysis.cta.timing : "missing"}
        value={analysis.cta.exists ? analysis.cta.clarity : 0}
      />
    </div>
  );
}

export function OverallSummary({ analysis }: Props) {
  const predicted = analysis.predictedMetrics;
  const badge = (level: "low" | "medium" | "high") => {
    const color =
      level === "high"
        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
        : level === "medium"
          ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
          : "bg-red-500/15 text-red-600 border-red-500/30";
    return (
      <span
        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
      >
        {level}
      </span>
    );
  };

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Target className="text-primary h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{analysis.overall.tagline}</h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {analysis.overall.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Predicted:</span>
            <span className="flex items-center gap-1">
              completion {badge(predicted.completionRate)}
            </span>
            <span className="flex items-center gap-1">
              engagement {badge(predicted.engagementRate)}
            </span>
          </div>
          <p className="text-muted-foreground mt-2 text-xs italic">
            {predicted.rationale}
          </p>
        </div>
      </div>
    </Card>
  );
}
