"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type Act = {
  name: string;
  start: number;
  end: number;
  summary: string;
};

type ScriptAngle = {
  angle: string;
  narrativeStyle: string;
  hookType: string;
  thesis: string;
  acts: Act[];
  copyHooks: string[];
};

type Props = {
  scriptAngle: ScriptAngle;
  totalDuration?: number;
};

const ANGLE_COLOR: Record<string, string> = {
  "problem-solution": "#ef4444",
  "before-after": "#f97316",
  listicle: "#f59e0b",
  testimonial: "#14b8a6",
  tutorial: "#3b82f6",
  challenge: "#8b5cf6",
  contrarian: "#ec4899",
  storytime: "#6366f1",
  "ugc-reaction": "#0ea5e9",
  comparison: "#06b6d4",
  mythbust: "#84cc16",
  "curiosity-tease": "#a855f7",
  "day-in-the-life": "#22c55e",
  "expert-explainer": "#0284c7",
  other: "#64748b",
};

const ACT_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#14b8a6",
  "#ef4444",
  "#a855f7",
];

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Badge({ label, variant = "default" }: { label: string; variant?: "default" | "muted" }) {
  if (variant === "muted") {
    return (
      <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-semibold">
      {label}
    </span>
  );
}

export function ScriptAngleCard({ scriptAngle, totalDuration }: Props) {
  if (!scriptAngle) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Script Angle</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No script analysis available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    angle,
    narrativeStyle,
    hookType,
    thesis,
    acts,
    copyHooks,
  } = scriptAngle;

  const dur =
    totalDuration && totalDuration > 0
      ? totalDuration
      : acts.length > 0
        ? Math.max(...acts.map((a) => a.end))
        : 1;

  const angleColor = ANGLE_COLOR[angle] ?? "#64748b";

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span
              className="inline-block rounded-lg px-3 py-1 text-sm font-bold text-white"
              style={{ background: angleColor }}
            >
              {angle}
            </span>
            <InfoTooltip metricKey="scriptAngle" side="bottom" />
          </div>
          <div className="flex items-center gap-1">
            <Badge label={narrativeStyle} variant="muted" />
            <InfoTooltip metricKey="narrativeStyle" side="bottom" />
          </div>
          <div className="flex items-center gap-1">
            <Badge label={hookType} variant="muted" />
            <InfoTooltip metricKey="hookType" side="bottom" />
          </div>
        </div>
        {thesis && (
          <p className="text-sm italic text-muted-foreground mt-2 leading-relaxed">
            &ldquo;{thesis}&rdquo;
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        {/* Acts Gantt */}
        {acts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Narrative Structure
              <InfoTooltip metricKey="acts" side="top" />
            </div>
            <div className="relative h-8 rounded-md overflow-hidden border bg-muted/20">
              {acts.map((act, i) => {
                const leftPct = (act.start / dur) * 100;
                const widthPct = Math.max(
                  2,
                  ((act.end - act.start) / dur) * 100
                );
                const color = ACT_COLORS[i % ACT_COLORS.length];
                return (
                  <div
                    className="absolute inset-y-0 flex items-center overflow-hidden"
                    key={`act-${i}`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: `${color}cc`,
                      borderLeft: `2px solid ${color}`,
                    }}
                    title={`${act.name}: ${fmt(act.start)} – ${fmt(act.end)}`}
                  >
                    {widthPct > 8 && (
                      <span className="px-1.5 text-[11px] font-semibold text-white truncate">
                        {act.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5">
              {acts.map((act, i) => (
                <div
                  className="flex gap-2 text-[11px]"
                  key={`act-detail-${i}`}
                >
                  <span
                    className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: ACT_COLORS[i % ACT_COLORS.length] }}
                  />
                  <span className="font-semibold min-w-[60px]">{act.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {fmt(act.start)}–{fmt(act.end)}
                  </span>
                  <span className="text-muted-foreground leading-tight">
                    {act.summary}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Copy hooks */}
        {copyHooks.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Copy Hooks
            </div>
            <ul className="space-y-1.5">
              {copyHooks.map((hook, i) => (
                <li
                  className="flex items-start gap-2 text-sm"
                  key={`hook-${i}`}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="italic leading-snug">&ldquo;{hook}&rdquo;</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
