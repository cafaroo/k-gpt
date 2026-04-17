"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const SCENE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  hook: { bg: "#3b82f6", text: "#dbeafe", border: "#1d4ed8" },
  problem: { bg: "#ef4444", text: "#fee2e2", border: "#b91c1c" },
  "product-intro": { bg: "#06b6d4", text: "#cffafe", border: "#0891b2" },
  "social-proof": { bg: "#14b8a6", text: "#ccfbf1", border: "#0d9488" },
  demo: { bg: "#f59e0b", text: "#fef3c7", border: "#d97706" },
  benefit: { bg: "#a855f7", text: "#f3e8ff", border: "#7c3aed" },
  cta: { bg: "#6366f1", text: "#e0e7ff", border: "#4338ca" },
  transition: { bg: "#6b7280", text: "#f3f4f6", border: "#4b5563" },
  other: { bg: "#64748b", text: "#f1f5f9", border: "#475569" },
};

function fallbackColor() {
  return { bg: "#64748b", text: "#f1f5f9", border: "#475569" };
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ScenesTimeline({ scenes, totalDuration, onSeek }: Props) {
  const [tooltip, setTooltip] = useState<{
    scene: Scene;
    pct: number;
  } | null>(null);

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

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    pct: f * 100,
    label: fmt(f * dur),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Scenes</CardTitle>
          <span className="text-xs text-muted-foreground">
            {sorted.length} scene{sorted.length === 1 ? "" : "s"}
          </span>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Object.entries(SCENE_COLORS)
            .filter(([type]) => sorted.some((s) => s.function === type))
            .map(([type, colors]) => (
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
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Single stacked bar track */}
        <div className="relative" style={{ height: "28px" }}>
          {sorted.map((scene, i) => {
            const colors = SCENE_COLORS[scene.function] ?? fallbackColor();
            const leftPct = (scene.start / dur) * 100;
            const widthPct = Math.max(
              0.8,
              ((scene.end - scene.start) / dur) * 100
            );
            const midPct = leftPct + widthPct / 2;
            return (
              <button
                className="absolute h-full rounded-sm cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 overflow-hidden"
                key={`scene-${i}-${scene.start}`}
                onClick={() => onSeek?.(scene.start)}
                onMouseEnter={() => setTooltip({ scene, pct: midPct })}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  minWidth: "4px",
                }}
                title={`${scene.label} · ${scene.function}`}
                type="button"
              >
                {widthPct > 8 && (
                  <span
                    className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium truncate"
                    style={{ color: colors.text }}
                  >
                    {scene.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Individual scene rows for detail */}
        <div className="mt-3 space-y-[2px]">
          {sorted.map((scene, i) => {
            const colors = SCENE_COLORS[scene.function] ?? fallbackColor();
            const leftPct = (scene.start / dur) * 100;
            const widthPct = Math.max(
              0.8,
              ((scene.end - scene.start) / dur) * 100
            );
            const midPct = leftPct + widthPct / 2;
            return (
              <div
                className="relative"
                key={`scene-row-${i}-${scene.start}`}
                style={{ height: "24px" }}
              >
                <button
                  className="absolute h-full rounded-sm cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2"
                  onClick={() => onSeek?.(scene.start)}
                  onMouseEnter={() => setTooltip({ scene, pct: midPct })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    background: `${colors.bg}40`,
                    border: `1px solid ${colors.border}80`,
                    minWidth: "4px",
                  }}
                  type="button"
                >
                  {widthPct > 10 && (
                    <span
                      className="absolute inset-0 flex items-center px-1.5 text-[10px] truncate"
                      style={{ color: colors.bg }}
                    >
                      {scene.label}
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
            className="pointer-events-none z-20"
            style={{
              position: "absolute",
              left: `clamp(8px, ${tooltip.pct}%, calc(100% - 200px))`,
              transform: "translateX(-50%)",
              bottom: "100%",
              marginBottom: "4px",
            }}
          >
            <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg max-w-[240px]">
              <div className="font-semibold mb-0.5">{tooltip.scene.label}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                {tooltip.scene.function}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mb-1">
                {fmt(tooltip.scene.start)} – {fmt(tooltip.scene.end)}
              </div>
              <p className="text-muted-foreground leading-snug">
                {tooltip.scene.description}
              </p>
              {tooltip.scene.visualStyle && (
                <p className="mt-1 text-[10px] text-muted-foreground italic">
                  Style: {tooltip.scene.visualStyle}
                </p>
              )}
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
