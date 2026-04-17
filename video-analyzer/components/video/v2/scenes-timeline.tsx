"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type Scene = {
  start: number;
  end: number;
  label: string;
  function: string;
  description: string;
  visualStyle?: string;
};

type Props = {
  scenes: Scene[];
  totalDuration: number;
  onSeek?: (time: number) => void;
};

const SCENE_COLORS: Record<string, string> = {
  hook: "#3b82f6",
  problem: "#ef4444",
  "product-intro": "#06b6d4",
  "social-proof": "#14b8a6",
  demo: "#f59e0b",
  benefit: "#a855f7",
  cta: "#6366f1",
  transition: "#6b7280",
  other: "#64748b",
};

function colorFor(fn: string) {
  return SCENE_COLORS[fn] ?? "#64748b";
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 2-lane packing — same logic as BeatMap.
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

export function ScenesTimeline({ scenes, totalDuration, onSeek }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!scenes || scenes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scenes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No scene data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const dur = totalDuration > 0 ? totalDuration : 1;
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  const laneItems = packLanes(sorted);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    pct: f * 100,
    label: fmt(f * dur),
  }));

  const LANE_HEIGHT = 40;
  const LANE_GAP = 4;
  const TRACK_HEIGHT = LANE_HEIGHT * 2 + LANE_GAP;

  const hoveredScene = hovered !== null ? (laneItems[hovered] ?? null) : null;
  const hoveredLeftPct =
    hoveredScene !== null
      ? (hoveredScene.start / dur) * 100 +
        (Math.max(0.8, ((hoveredScene.end - hoveredScene.start) / dur) * 100)) /
          2
      : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <CardTitle className="text-base">Scenes</CardTitle>
            <InfoTooltip metricKey="acts" side="bottom" />
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {laneItems.length} scenes · {fmt(dur)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Legend */}
        <div className="flex flex-wrap gap-1">
          {Array.from(new Set(laneItems.map((s) => s.function))).map((fn) => (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60"
              key={fn}
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: colorFor(fn) }}
              />
              {fn}
            </span>
          ))}
        </div>

        {/* Track */}
        <div
          className="relative rounded-md border bg-muted/20 overflow-hidden"
          style={{ height: `${TRACK_HEIGHT}px` }}
        >
          {/* Lane separator */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border/40 pointer-events-none"
            style={{ top: `${LANE_HEIGHT + LANE_GAP / 2}px` }}
          />

          {laneItems.map((scene, i) => {
            const leftPct = (scene.start / dur) * 100;
            const widthPct = Math.max(
              0.8,
              ((scene.end - scene.start) / dur) * 100
            );
            const color = colorFor(scene.function);
            const top = scene.lane === 0 ? 0 : LANE_HEIGHT + LANE_GAP;
            return (
              <button
                className="absolute cursor-pointer transition-all hover:brightness-110 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                key={`scene-${i}-${scene.start}`}
                onClick={() => onSeek?.(scene.start)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: `${top + 2}px`,
                  height: `${LANE_HEIGHT - 4}px`,
                  background: `linear-gradient(to bottom, ${color}e0, ${color}a0)`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: "3px",
                  minWidth: "4px",
                }}
                type="button"
              >
                {widthPct > 5 && (
                  <span className="absolute inset-0 flex flex-col items-start justify-center px-2 gap-0 text-white/95 overflow-hidden">
                    <span className="text-[11px] font-semibold leading-tight truncate w-full">
                      {scene.label}
                    </span>
                    {widthPct > 10 && (
                      <span className="text-[9px] uppercase opacity-80 tracking-tight leading-tight truncate w-full">
                        {scene.function}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}

          {/* Tooltip */}
          {hoveredScene && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `clamp(8px, ${hoveredLeftPct}%, calc(100% - 260px))`,
                top: "100%",
                marginTop: "6px",
              }}
            >
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl max-w-[280px]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: colorFor(hoveredScene.function) }}
                  />
                  <span className="font-semibold">{hoveredScene.label}</span>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                  {hoveredScene.function}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mb-1">
                  {fmt(hoveredScene.start)} – {fmt(hoveredScene.end)} · lane{" "}
                  {hoveredScene.lane + 1}
                </div>
                <p className="text-muted-foreground leading-snug">
                  {hoveredScene.description}
                </p>
                {hoveredScene.visualStyle && (
                  <p className="mt-1 text-[10px] text-muted-foreground italic">
                    Style: {hoveredScene.visualStyle}
                  </p>
                )}
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
