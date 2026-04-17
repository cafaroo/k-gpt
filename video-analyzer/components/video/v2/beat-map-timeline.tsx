"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

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

const BEAT_COLORS: Record<string, string> = {
  hook: "#3b82f6",
  problem: "#ef4444",
  "micro-proof": "#10b981",
  payoff: "#f59e0b",
  benefit: "#a855f7",
  "social-proof": "#14b8a6",
  objection: "#ec4899",
  "product-intro": "#06b6d4",
  transition: "#6b7280",
  "soft-cta": "#6366f1",
  "hard-cta": "#8b5cf6",
  "how-to-step": "#84cc16",
};

function colorFor(type: string) {
  return BEAT_COLORS[type] ?? "#64748b";
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Pack beats into 2 alternating lanes — like a video editor track layout.
// Greedy: each beat goes to the lane where the last-assigned beat ends
// earliest (and ≤ start). Produces compact 2-row stacking even when
// beats overlap slightly.
function packLanes<T extends { start: number; end: number }>(
  items: T[]
): Array<T & { lane: 0 | 1 }> {
  const laneEnd = [0, 0];
  return items.map((item) => {
    const l0Free = laneEnd[0] <= item.start;
    const l1Free = laneEnd[1] <= item.start;
    let lane: 0 | 1;
    if (l0Free && !l1Free) lane = 0;
    else if (!l0Free && l1Free) lane = 1;
    else if (l0Free && l1Free) lane = laneEnd[0] <= laneEnd[1] ? 0 : 1;
    else lane = laneEnd[0] <= laneEnd[1] ? 0 : 1;
    laneEnd[lane] = item.end;
    return { ...item, lane };
  });
}

export function BeatMapTimeline({ beatMap, totalDuration, onSeek }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

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
  const laneItems = packLanes(sorted);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    pct: f * 100,
    label: fmt(f * dur),
  }));

  const LANE_HEIGHT = 36;
  const LANE_GAP = 4;
  const TRACK_HEIGHT = LANE_HEIGHT * 2 + LANE_GAP;

  const hoveredBeat =
    hovered !== null ? (laneItems[hovered] ?? null) : null;
  const hoveredLeftPct =
    hoveredBeat !== null
      ? (hoveredBeat.start / dur) * 100 +
        (Math.max(0.8, ((hoveredBeat.end - hoveredBeat.start) / dur) * 100)) / 2
      : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <CardTitle className="text-base">Beat Map</CardTitle>
            <InfoTooltip metricKey="patternInterrupts" side="bottom" />
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {laneItems.length} beats · {fmt(dur)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Legend */}
        <div className="flex flex-wrap gap-1">
          {Array.from(new Set(laneItems.map((b) => b.type))).map((type) => (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60"
              key={type}
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: colorFor(type) }}
              />
              {type}
            </span>
          ))}
        </div>

        {/* Track */}
        <div
          className="relative rounded-md border bg-muted/20 overflow-hidden"
          style={{ height: `${TRACK_HEIGHT}px` }}
        >
          {/* Mid-line separator */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border/40 pointer-events-none"
            style={{ top: `${LANE_HEIGHT + LANE_GAP / 2}px` }}
          />

          {laneItems.map((beat, i) => {
            const leftPct = (beat.start / dur) * 100;
            const widthPct = Math.max(
              0.8,
              ((beat.end - beat.start) / dur) * 100
            );
            const color = colorFor(beat.type);
            const top =
              beat.lane === 0 ? 0 : LANE_HEIGHT + LANE_GAP;
            const strengthOpacity = Math.max(
              0.6,
              Math.min(1, beat.strength / 10)
            );
            return (
              <button
                className="absolute rounded-[3px] cursor-pointer transition-all hover:brightness-110 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                key={`beat-${i}-${beat.start}`}
                onClick={() => onSeek?.(beat.start)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: `${top + 2}px`,
                  height: `${LANE_HEIGHT - 4}px`,
                  background: `linear-gradient(to bottom, ${color}ee, ${color}bb)`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: "3px",
                  opacity: strengthOpacity,
                  minWidth: "4px",
                }}
                type="button"
              >
                {widthPct > 5 && (
                  <span className="absolute inset-0 flex items-center justify-between px-2 gap-1 text-white/95 overflow-hidden">
                    <span className="text-[10px] font-semibold tracking-tight uppercase truncate">
                      {beat.type}
                    </span>
                    {widthPct > 14 && (
                      <span className="text-[9px] tabular-nums opacity-70 shrink-0 font-mono">
                        {fmt(beat.start)}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}

          {/* Tooltip */}
          {hoveredBeat && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `clamp(8px, ${hoveredLeftPct}%, calc(100% - 240px))`,
                top: "100%",
                marginTop: "6px",
              }}
            >
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl max-w-[260px]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: colorFor(hoveredBeat.type) }}
                  />
                  <span className="font-semibold capitalize">
                    {hoveredBeat.type}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mb-1">
                  {fmt(hoveredBeat.start)} – {fmt(hoveredBeat.end)} · lane{" "}
                  {hoveredBeat.lane + 1}
                </div>
                <p className="text-muted-foreground leading-snug">
                  {hoveredBeat.description}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    Strength
                  </span>
                  <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(hoveredBeat.strength / 10) * 100}%`,
                        background: colorFor(hoveredBeat.type),
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums">
                    {hoveredBeat.strength.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Time axis */}
        <div className="relative h-4">
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
