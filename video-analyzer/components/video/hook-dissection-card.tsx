"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  hookDissection: AnalysisExtended["hookDissection"];
  hookDuration?: number;
  onSeek?: (time: number) => void;
};

export function HookDissectionCard({
  hookDissection,
  hookDuration,
  onSeek,
}: Props) {
  const { firstSecond, firstThreeSeconds, curiosityGap, stopPower } =
    hookDissection;

  // Show every per-second sample we got. Cap at 8 to keep the grid readable
  // on narrow screens; analysts rarely need second-by-second detail beyond
  // the hook window.
  const perSecond = firstThreeSeconds.slice(0, 8);
  const lastSecond =
    perSecond.length > 0
      ? Math.max(...perSecond.map((s) => s.second))
      : Math.max(3, Math.ceil(hookDuration ?? 3));
  const titleRange = `0–${lastSecond}s`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">
          Hook dissection ({titleRange})
        </CardTitle>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold text-emerald-500">
            {stopPower.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-xs">/10 stop power</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1 rounded-md border-l-4 border-l-amber-500 bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide">
            First second
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Visual: </span>
            {firstSecond.visualDescription}
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Audio: </span>
            {firstSecond.audioEvent}
          </div>
          {firstSecond.textOnScreen && (
            <div className="text-xs">
              <span className="text-muted-foreground">Text: </span>
              {firstSecond.textOnScreen}
            </div>
          )}
          <div className="text-xs">
            <span className="text-muted-foreground">Promise: </span>
            <em>{firstSecond.promiseEstablished}</em>
          </div>
          {firstSecond.attentionTriggers.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {firstSecond.attentionTriggers.map((t) => (
                <span
                  className="bg-amber-500/15 text-amber-700 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  key={t}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {perSecond.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Second-by-second
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(perSecond.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {perSecond.map((s) => (
                <button
                  className="hover:bg-muted/40 rounded-md border p-2 text-left text-xs"
                  key={`sec-${s.second}`}
                  onClick={() => onSeek?.(s.second)}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-mono">
                      {s.second}s
                    </span>
                    <span className="text-emerald-500 text-[10px]">
                      {s.tension.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-medium">
                    {s.visual}
                  </div>
                  <div className="text-muted-foreground mt-1 line-clamp-1 text-[10px]">
                    {s.audio}
                  </div>
                  {s.text && (
                    <div className="mt-1 line-clamp-1 text-[10px] italic">
                      "{s.text}"
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md bg-muted/30 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide">
            Curiosity gap
          </div>
          <div className="flex items-start gap-2 text-xs">
            <span
              className={
                curiosityGap.present
                  ? "text-emerald-500 font-medium"
                  : "text-muted-foreground"
              }
            >
              {curiosityGap.present ? "Present" : "Missing"}
            </span>
            <span className="flex-1">{curiosityGap.description}</span>
          </div>
          {curiosityGap.resolvesAt !== null && (
            <div className="text-muted-foreground mt-1 text-xs">
              Resolves at{" "}
              <button
                className="hover:text-foreground font-mono"
                onClick={() => onSeek?.(curiosityGap.resolvesAt ?? 0)}
                type="button"
              >
                {curiosityGap.resolvesAt.toFixed(1)}s
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
