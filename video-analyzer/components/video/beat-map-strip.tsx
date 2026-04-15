"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
  duration: number;
  onSeek?: (time: number) => void;
};

const BEAT_COLORS: Record<QwenAnalysis["beatMap"][number]["type"], string> = {
  hook: "bg-red-500",
  problem: "bg-orange-500",
  "micro-proof": "bg-fuchsia-500",
  "how-to-step": "bg-cyan-500",
  payoff: "bg-emerald-500",
  benefit: "bg-teal-500",
  "social-proof": "bg-purple-500",
  objection: "bg-amber-500",
  "product-intro": "bg-blue-500",
  transition: "bg-slate-400",
  "soft-cta": "bg-pink-400",
  "hard-cta": "bg-pink-600",
  reveal: "bg-lime-500",
  recap: "bg-indigo-400",
  other: "bg-slate-500",
};

const CANONICAL = [
  { beat: "hook", window: "0:00–0:02" },
  { beat: "micro-proof", window: "0:02–0:04" },
  { beat: "how-to-step", window: "0:04–end-2s" },
  { beat: "soft-cta or hard-cta", window: "last 2s" },
] as const;

export function BeatMapStrip({ analysis, duration, onSeek }: Props) {
  const beats = analysis.beatMap;
  if (beats.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Beat map</CardTitle>
        <span className="text-muted-foreground text-xs">
          canonical: hook → micro-proof → how-to → soft-CTA
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Strip */}
        <div className="relative h-8 w-full overflow-hidden rounded-md bg-muted">
          {beats.map((b) => {
            const left = (b.start / duration) * 100;
            const width = ((b.end - b.start) / duration) * 100;
            const color = BEAT_COLORS[b.type] ?? BEAT_COLORS.other;
            return (
              <button
                className={`absolute top-0 bottom-0 ${color} border-r border-white/30 px-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 truncate`}
                key={`${b.start}-${b.end}-${b.type}`}
                onClick={() => onSeek?.(b.start)}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${b.type} · ${b.start.toFixed(1)}–${b.end.toFixed(1)}s\n${b.description}`}
                type="button"
              >
                {width > 6 ? b.type : ""}
              </button>
            );
          })}
        </div>

        {/* Canonical guide */}
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {CANONICAL.map((c) => (
            <span key={c.beat}>
              <strong>{c.beat}</strong> {c.window}
            </span>
          ))}
        </div>

        {/* Beat list */}
        <div className="space-y-1.5">
          {beats.map((b) => {
            const color = BEAT_COLORS[b.type] ?? BEAT_COLORS.other;
            return (
              <button
                className="flex w-full gap-2 rounded border p-2 text-left text-xs transition-colors hover:bg-muted/50"
                key={`row-${b.start}-${b.type}`}
                onClick={() => onSeek?.(b.start)}
                type="button"
              >
                <span
                  className={`shrink-0 self-start rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${color}`}
                >
                  {b.type}
                </span>
                <span className="flex-1">{b.description}</span>
                <span className="text-muted-foreground shrink-0">
                  {b.start.toFixed(1)}–{b.end.toFixed(1)}s · {b.strength}/10
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
