"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

// ── Types ──────────────────────────────────────────────────────────────────────

type PredictedMetrics = {
  completionRate?: string | null;
  engagementRate?: string | null;
  holdTo3sScore?: number | null;
  saveLikelihood?: number | null;
  commentLikelihood?: number | null;
  shareLikelihood?: number | null;
  rationale?: string | null;
};

type Props = {
  metrics?: PredictedMetrics | null;
};

// ── Color helpers ──────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, { bar: string; text: string }> = {
  low: { bar: "#ef4444", text: "#ef4444" },
  medium: { bar: "#f59e0b", text: "#f59e0b" },
  high: { bar: "#10b981", text: "#10b981" },
};

function levelColor(level: string) {
  return LEVEL_COLORS[level.toLowerCase()] ?? { bar: "#64748b", text: "#64748b" };
}

function scoreColor(score: number): string {
  if (score >= 8) return "#10b981";
  if (score >= 5) return "#f59e0b";
  return "#ef4444";
}

// ── Normalize hold-to-3s: Gemini sometimes emits 0-100 instead of 0-10 ────────
function normalizeHold(v: number): number {
  return v > 10 ? Math.min(100, v) : Math.min(100, v * 10);
}

// ── 3-segment level bar ────────────────────────────────────────────────────────

const SEGMENTS: { key: string; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Med" },
  { key: "high", label: "High" },
];

function LevelBar({ active }: { active: string }) {
  const norm = active.toLowerCase();
  return (
    <div className="flex gap-0.5 h-2 rounded overflow-hidden">
      {SEGMENTS.map((seg) => (
        <div
          key={seg.key}
          className="flex-1 rounded-sm transition-all"
          style={{
            background:
              seg.key === norm ? levelColor(norm).bar : "hsl(var(--muted))",
            opacity: seg.key === norm ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
}

// ── Mini bar (0-10) ────────────────────────────────────────────────────────────

function MiniBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ── Circular gauge for Hold-to-3s (0-100) ─────────────────────────────────────

function CircularGauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const color = value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#ef4444";
  const r = 20;
  const circ = Math.PI * r; // half arc
  const dashOffset = circ - pct * circ;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="48" height="28" viewBox="0 0 48 28">
        <path
          d="M4 24 A20 20 0 0 1 44 24"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M4 24 A20 20 0 0 1 44 24"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="text-xl font-bold tabular-nums leading-none" style={{ color }}>
        {value.toFixed(0)}
        <span className="text-[10px] font-normal text-muted-foreground">%</span>
      </div>
    </div>
  );
}

// ── Cell components ────────────────────────────────────────────────────────────

const LEVEL_CELL_KEYS: Record<string, string> = {
  "Completion Rate": "completionRate",
  "Engagement Rate": "engagementRate",
};

function LevelCell({ label, value }: { label: string; value: string }) {
  const { text } = levelColor(value);
  const metricKey = LEVEL_CELL_KEYS[label];
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
        {metricKey && <InfoTooltip metricKey={metricKey} side="top" />}
      </div>
      <div className="text-lg font-bold capitalize" style={{ color: text }}>
        {value}
      </div>
      <LevelBar active={value} />
    </div>
  );
}

function Hold3sCell({ value }: { value: number }) {
  const normalized = normalizeHold(value);
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Hold to 3s
        <InfoTooltip metricKey="holdTo3sScore" side="top" />
      </div>
      <CircularGauge value={normalized} />
    </div>
  );
}

const SCORE_CELL_KEYS: Record<string, string> = {
  "Save Likelihood": "saveLikelihood",
  "Comment Likelihood": "commentLikelihood",
  "Share Likelihood": "shareLikelihood",
};

function ScoreCell({ label, value }: { label: string; value: number }) {
  const color = scoreColor(Math.max(0, Math.min(10, value)));
  const metricKey = SCORE_CELL_KEYS[label];
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
        {metricKey && <InfoTooltip metricKey={metricKey} side="top" />}
      </div>
      <div className="text-lg font-bold tabular-nums" style={{ color }}>
        {value.toFixed(1)}
        <span className="text-[10px] font-normal text-muted-foreground">/10</span>
      </div>
      <MiniBar value={value} color={color} />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function PredictedMetricsGridV2({ metrics }: Props) {
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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {completionRate && (
            <LevelCell label="Completion Rate" value={completionRate} />
          )}
          {engagementRate && (
            <LevelCell label="Engagement Rate" value={engagementRate} />
          )}
          {holdTo3sScore != null && <Hold3sCell value={holdTo3sScore} />}
          {saveLikelihood != null && (
            <ScoreCell label="Save Likelihood" value={saveLikelihood} />
          )}
          {commentLikelihood != null && (
            <ScoreCell label="Comment Likelihood" value={commentLikelihood} />
          )}
          {shareLikelihood != null && (
            <ScoreCell label="Share Likelihood" value={shareLikelihood} />
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
