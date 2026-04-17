"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type Cut = {
  timestamp: number;
  type:
    | "hard-cut"
    | "jump-cut"
    | "match-cut"
    | "dissolve"
    | "cross-dissolve"
    | "fade-in"
    | "fade-out"
    | "wipe"
    | "whip-pan"
    | "zoom-cut"
    | "other";
  beforeShot: string;
  afterShot: string;
  intent?: string;
};

type Props = {
  cutsMap: Cut[];
  totalDuration: number;
  onSeek?: (time: number) => void;
};

const TICK_TYPE_COLOR: Record<string, string> = {
  "hard-cut": "#ef4444",
  "jump-cut": "#f97316",
  "match-cut": "#a855f7",
  dissolve: "#06b6d4",
  "cross-dissolve": "#0ea5e9",
  "fade-in": "#6366f1",
  "fade-out": "#4f46e5",
  wipe: "#14b8a6",
  "whip-pan": "#f59e0b",
  "zoom-cut": "#84cc16",
  other: "#64748b",
};

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CutsTimeline({ cutsMap, totalDuration, onSeek }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!cutsMap || cutsMap.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cuts Map</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No cuts data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const dur = totalDuration > 0 ? totalDuration : 1;
  const sorted = [...cutsMap].sort((a, b) => a.timestamp - b.timestamp);

  const types = Array.from(new Set(sorted.map((c) => c.type)));

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    pct: f * 100,
    label: fmt(f * dur),
  }));

  const hoveredCut = hovered !== null ? sorted[hovered] : null;
  const hoveredPct =
    hoveredCut !== null
      ? (hoveredCut.timestamp / dur) * 100
      : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <CardTitle className="text-base">Cuts Map</CardTitle>
            <InfoTooltip metricKey="cutsMap" side="bottom" />
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {sorted.length} cuts · {fmt(dur)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Legend */}
        <div className="flex flex-wrap gap-1">
          {types.map((type) => (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60"
              key={type}
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: TICK_TYPE_COLOR[type] ?? "#64748b" }}
              />
              {type}
            </span>
          ))}
        </div>

        {/* Track */}
        <div className="relative">
          <div className="relative h-8 rounded-md border bg-muted/20 overflow-visible">
            {/* Baseline */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-border/40" />

            {sorted.map((cut, i) => {
              const leftPct = (cut.timestamp / dur) * 100;
              const color = TICK_TYPE_COLOR[cut.type] ?? "#64748b";
              const isHov = hovered === i;

              return (
                <button
                  aria-label={`${cut.type} at ${fmt(cut.timestamp)}`}
                  className="absolute top-0 h-full cursor-pointer focus:outline-none"
                  key={`cut-${i}-${cut.timestamp}`}
                  onClick={() => onSeek?.(cut.timestamp)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    left: `${leftPct}%`,
                    transform: "translateX(-50%)",
                    width: "12px",
                    zIndex: isHov ? 20 : 1,
                  }}
                  type="button"
                >
                  <div
                    className="absolute left-1/2 -translate-x-1/2 transition-all duration-75"
                    style={{
                      top: isHov ? "2px" : "4px",
                      bottom: isHov ? "2px" : "4px",
                      width: isHov ? "3px" : "2px",
                      background: color,
                      borderRadius: "2px",
                      boxShadow: isHov ? `0 0 6px ${color}` : "none",
                    }}
                  />
                </button>
              );
            })}

            {/* Tooltip */}
            {hoveredCut && (
              <div
                className="pointer-events-none absolute z-30"
                style={{
                  left: `clamp(8px, ${hoveredPct}%, calc(100% - 280px))`,
                  top: "100%",
                  marginTop: "8px",
                }}
              >
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl max-w-[300px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{
                        background:
                          TICK_TYPE_COLOR[hoveredCut.type] ?? "#64748b",
                      }}
                    />
                    <span className="font-semibold uppercase tracking-wide text-[11px]">
                      {hoveredCut.type}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {fmt(hoveredCut.timestamp)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <p>
                      <span className="text-muted-foreground">Out: </span>
                      {hoveredCut.beforeShot}
                    </p>
                    <p>
                      <span className="text-muted-foreground">In: </span>
                      {hoveredCut.afterShot}
                    </p>
                    {hoveredCut.intent && (
                      <p className="text-muted-foreground italic mt-1">
                        {hoveredCut.intent}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time axis */}
          <div className="relative h-4 mt-1">
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
        </div>

        {/* Summary stats */}
        <div className="flex flex-wrap gap-3 pt-1">
          {types.map((type) => {
            const count = sorted.filter((c) => c.type === type).length;
            return (
              <div
                className="flex items-center gap-1 text-[11px]"
                key={type}
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: TICK_TYPE_COLOR[type] ?? "#64748b" }}
                />
                <span className="text-muted-foreground">{type}</span>
                <span className="font-semibold tabular-nums">×{count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
