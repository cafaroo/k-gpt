"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
  duration: number;
  onSeek?: (time: number) => void;
};

const FUNCTION_COLORS: Record<
  QwenAnalysis["scenes"][number]["function"],
  string
> = {
  hook: "bg-red-500/80 text-white",
  problem: "bg-orange-500/80 text-white",
  "product-intro": "bg-blue-500/80 text-white",
  "social-proof": "bg-purple-500/80 text-white",
  demo: "bg-cyan-500/80 text-white",
  benefit: "bg-emerald-500/80 text-white",
  cta: "bg-pink-500/80 text-white",
  transition: "bg-slate-400/60 text-white",
  other: "bg-slate-500/60 text-white",
};

export function SceneNarrative({ analysis, duration, onSeek }: Props) {
  const scenes = analysis.scenes;
  if (scenes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Scene narrative</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timeline bar */}
        <div className="relative h-10 w-full overflow-hidden rounded-md bg-muted">
          {scenes.map((s) => {
            const left = (s.start / duration) * 100;
            const width = ((s.end - s.start) / duration) * 100;
            const color = FUNCTION_COLORS[s.function] ?? FUNCTION_COLORS.other;
            return (
              <button
                className={`absolute top-0 bottom-0 ${color} border-r border-white/30 px-1 text-[10px] font-medium transition-opacity hover:opacity-90 truncate`}
                key={`s-${s.start}-${s.end}`}
                onClick={() => onSeek?.(s.start)}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${s.label} (${s.start.toFixed(1)}–${s.end.toFixed(1)}s)`}
                type="button"
              >
                {width > 8 ? s.function : ""}
              </button>
            );
          })}
        </div>

        {/* Scene list */}
        <div className="space-y-2">
          {scenes.map((s) => {
            const color = FUNCTION_COLORS[s.function] ?? FUNCTION_COLORS.other;
            return (
              <button
                className="flex w-full gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted/50"
                key={`row-${s.start}-${s.end}-${s.function}`}
                onClick={() => onSeek?.(s.start)}
                type="button"
              >
                <span
                  className={`shrink-0 self-start rounded px-1.5 py-0.5 text-[10px] font-semibold ${color}`}
                >
                  {s.function}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {s.label}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {s.start.toFixed(1)}–{s.end.toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {s.description}
                  </p>
                  {s.textOnScreen && (
                    <p className="mt-1 text-xs italic">“{s.textOnScreen}”</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
