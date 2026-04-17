"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PredictedMetrics = {
  completionRate?: string;
  engagementRate?: string;
  holdTo3sScore?: number;
  saveLikelihood?: number;
  commentLikelihood?: number;
  shareLikelihood?: number;
  rationale?: string;
};

type Props = {
  metrics?: PredictedMetrics | null;
};

function levelColor(level: string): { bg: string; text: string; fill: number } {
  const map: Record<string, { bg: string; text: string; fill: number }> = {
    low: { bg: "#ef444420", text: "#ef4444", fill: 20 },
    medium: { bg: "#f59e0b20", text: "#f59e0b", fill: 50 },
    high: { bg: "#10b98120", text: "#10b981", fill: 85 },
  };
  return (
    map[level.toLowerCase()] ?? { bg: "#64748b20", text: "#64748b", fill: 40 }
  );
}

function scoreColor(score: number): string {
  if (score >= 7) {
    return "#10b981";
  }
  if (score >= 4) {
    return "#f59e0b";
  }
  return "#ef4444";
}

function LevelCell({ label, value }: { label: string; value: string }) {
  const { bg, text, fill } = levelColor(value);
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className="rounded-full px-3 py-1 text-sm font-semibold capitalize self-start"
        style={{ background: bg, color: text }}
      >
        {value}
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${fill}%`, background: text }}
        />
      </div>
    </div>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  const pct = Math.max(0, Math.min(10, value)) * 10;
  // SVG gauge arc
  const r = 20;
  const circ = Math.PI * r; // half circle = π*r
  const dashArray = circ;
  const dashOffset = circ - (pct / 100) * circ;

  return (
    <div className="rounded-lg border p-3 flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center gap-3">
        <svg className="shrink-0" height="28" viewBox="0 0 48 28" width="48">
          <path
            d="M4 24 A20 20 0 0 1 44 24"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M4 24 A20 20 0 0 1 44 24"
            fill="none"
            stroke={color}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
        <div className="text-2xl font-bold tabular-nums" style={{ color }}>
          {value.toFixed(1)}
          <span className="text-xs font-normal text-muted-foreground">/10</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function PredictedMetricsGrid({ metrics }: Props) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Predicted Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No predicted metrics available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    completionRate,
    engagementRate,
    holdTo3sScore,
    saveLikelihood,
    commentLikelihood,
    shareLikelihood,
    rationale,
  } = metrics;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Predicted Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {completionRate && (
            <LevelCell label="Completion rate" value={completionRate} />
          )}
          {engagementRate && (
            <LevelCell label="Engagement rate" value={engagementRate} />
          )}
          {holdTo3sScore != null && (
            <ScoreCell label="Hold to 3s" value={holdTo3sScore} />
          )}
          {saveLikelihood != null && (
            <ScoreCell label="Save likelihood" value={saveLikelihood} />
          )}
          {commentLikelihood != null && (
            <ScoreCell label="Comment likelihood" value={commentLikelihood} />
          )}
          {shareLikelihood != null && (
            <ScoreCell label="Share likelihood" value={shareLikelihood} />
          )}
        </div>
        {rationale && (
          <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-muted pl-3">
            {rationale}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
