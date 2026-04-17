"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Beat = {
  type: string;
  start: number;
  end: number;
  description: string;
  strength: number;
};

type Props = {
  beatMap: Beat[];
  totalDuration: number;
  onSeek?: (time: number) => void;
};

const BEAT_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  hook: { bg: "#3b82f6", text: "#dbeafe", border: "#1d4ed8" },
  problem: { bg: "#ef4444", text: "#fee2e2", border: "#b91c1c" },
  "micro-proof": { bg: "#10b981", text: "#d1fae5", border: "#059669" },
  payoff: { bg: "#f59e0b", text: "#fef3c7", border: "#d97706" },
  benefit: { bg: "#a855f7", text: "#f3e8ff", border: "#7c3aed" },
  "social-proof": { bg: "#14b8a6", text: "#ccfbf1", border: "#0d9488" },
  objection: { bg: "#ec4899", text: "#fce7f3", border: "#be185d" },
  "product-intro": { bg: "#06b6d4", text: "#cffafe", border: "#0891b2" },
  transition: { bg: "#6b7280", text: "#f3f4f6", border: "#4b5563" },
  "soft-cta": { bg: "#6366f1", text: "#e0e7ff", border: "#4338ca" },
  "hard-cta": { bg: "#8b5cf6", text: "#ede9fe", border: "#6d28d9" },
  "how-to-step": { bg: "#84cc16", text: "#ecfccb", border: "#65a30d" },
};

function fallbackColor() {
  return { bg: "#64748b", text: "#f1f5f9", border: "#475569" };
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BeatMapTimeline({ beatMap, totalDuration, onSeek }: Props) {
  const [tooltip, setTooltip] = useState<{
    beat: Beat;
    pct: number;
  } | null>(null);

  if (!beatMap || beatMap.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Beat Map</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No beat data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const dur = totalDuration > 0 ? totalDuration : 1;
  const sorted = [...beatMap].sort((a, b) => a.start - b.start);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    pct: f * 100,
    label: fmt(f * dur),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Beat Map</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Legend */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(BEAT_COLORS).map(([type, colors]) => (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              key={type}
              style={{
                background: `${colors.bg}33`,
                color: colors.bg,
                border: `1px solid ${colors.bg}55`,
              }}
            >
              {type}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-[3px] relative">
          {sorted.map((beat, i) => {
            const colors = BEAT_COLORS[beat.type] ?? fallbackColor();
            const leftPct = (beat.start / dur) * 100;
            const widthPct = Math.max(
              0.8,
              ((beat.end - beat.start) / dur) * 100
            );
            const midPct = leftPct + widthPct / 2;
            return (
              <div
                className="relative"
                key={`beat-${i}-${beat.start}`}
                style={{ height: "28px" }}
              >
                <button
                  className="absolute h-full rounded cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2"
                  onClick={() => onSeek?.(beat.start)}
                  onMouseEnter={() => setTooltip({ beat, pct: midPct })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    minWidth: "4px",
                  }}
                  title={`${beat.type} · ${beat.description} (strength ${beat.strength}/10)`}
                  type="button"
                >
                  {widthPct > 6 && (
                    <span
                      className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium truncate"
                      style={{ color: colors.text }}
                    >
                      {beat.type}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 -mt-1"
            style={{
              left: `clamp(8px, ${tooltip.pct}%, calc(100% - 180px))`,
              transform: "translateX(-50%)",
              bottom: "100%",
              marginBottom: "4px",
            }}
          >
            <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg max-w-[220px]">
              <div className="font-semibold capitalize mb-0.5">
                {tooltip.beat.type}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mb-1">
                {fmt(tooltip.beat.start)} – {fmt(tooltip.beat.end)}
              </div>
              <p className="text-muted-foreground leading-snug">
                {tooltip.beat.description}
              </p>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Strength: {tooltip.beat.strength}/10
              </div>
            </div>
          </div>
        )}

        {/* Time axis */}
        <div className="relative h-5 mt-1">
          {ticks.map((tick) => (
            <span
              className="absolute -translate-x-1/2 text-[10px] text-muted-foreground font-mono"
              key={tick.pct}
              style={{ left: `${tick.pct}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
