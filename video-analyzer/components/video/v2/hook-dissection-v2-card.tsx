"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ──────────────────────────────────────────────────────────────────────

type FirstSecond = {
  visualDescription: string;
  audioEvent: string;
  textOnScreen?: string | null;
  attentionTriggers: string[];
  promiseEstablished: string;
};

type PerSecond = {
  second: number;
  visual: string;
  audio: string;
  text?: string | null;
  tension: number;
};

type CuriosityGap = {
  present: boolean;
  description: string;
  resolvesAt: number | null;
};

type HookDissection = {
  firstSecond: FirstSecond;
  firstThreeSeconds: PerSecond[];
  curiosityGap: CuriosityGap;
  stopPower: number;
  colloquialityScore?: number;
};

type Props = {
  hookDissection: HookDissection;
  hookDuration?: number;
  onSeek?: (time: number) => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1);
  return m > 0 ? `${m}:${s.padStart(4, "0")}` : `${s}s`;
}

function stopPowerColor(v: number): string {
  if (v >= 8) return "#10b981";
  if (v >= 5) return "#f59e0b";
  return "#ef4444";
}

// SVG circular gauge – half-arc (like a speedometer)
function CircleGauge({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const color = stopPowerColor(value);
  const r = 22;
  const circ = Math.PI * r;
  const dashOffset = circ - pct * circ;

  return (
    <svg width="56" height="32" viewBox="0 0 56 32">
      <path
        d="M4 28 A22 22 0 0 1 52 28"
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M4 28 A22 22 0 0 1 52 28"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
}

// ── Frame strip ────────────────────────────────────────────────────────────────

function FrameCell({
  entry,
  onSeek,
}: {
  entry: PerSecond;
  onSeek?: (t: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tensionPct = Math.max(0, Math.min(10, entry.tension)) * 10;

  return (
    <button
      type="button"
      className="rounded-md border bg-muted/20 p-2 text-left flex flex-col gap-1 hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 min-w-0"
      onClick={() => {
        onSeek?.(entry.second);
        setExpanded((v) => !v);
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="text-[10px] font-mono font-semibold text-muted-foreground">
        {entry.second}s
      </div>
      <div
        className={`text-[11px] font-medium leading-snug ${expanded ? "" : "line-clamp-2"}`}
      >
        {entry.visual}
      </div>
      {(expanded || !entry.visual) && (
        <>
          {entry.audio && (
            <div className="text-[10px] text-muted-foreground leading-snug">
              {entry.audio}
            </div>
          )}
          {entry.text && (
            <div className="text-[10px] italic text-muted-foreground leading-snug">
              "{entry.text}"
            </div>
          )}
        </>
      )}
      {/* Tension bar */}
      <div className="mt-auto pt-1 w-full">
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${tensionPct}%`, background: "#3b82f6" }}
          />
        </div>
        <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
          tension {entry.tension.toFixed(1)}
        </div>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HookDissectionV2Card({ hookDissection, hookDuration, onSeek }: Props) {
  const { firstSecond, firstThreeSeconds, curiosityGap, stopPower, colloquialityScore } =
    hookDissection;

  const perSecond = firstThreeSeconds.slice(0, 8);
  const lastSecond =
    perSecond.length > 0
      ? Math.max(...perSecond.map((s) => s.second))
      : Math.max(3, Math.ceil(hookDuration ?? 3));

  const colloqPct = colloquialityScore != null
    ? Math.max(0, Math.min(10, colloquialityScore)) * 10
    : null;

  const colloqColor =
    colloquialityScore == null
      ? "#64748b"
      : colloquialityScore >= 8
      ? "#10b981"
      : colloquialityScore >= 5
      ? "#f59e0b"
      : "#ef4444";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Hook Dissection (0–{lastSecond}s)
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Row 1: Stop power gauge + colloquiality bar + curiosity gap pill */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Stop power */}
          <div className="flex flex-col items-center gap-0.5">
            <CircleGauge value={stopPower} />
            <div
              className="text-2xl font-bold tabular-nums leading-none"
              style={{ color: stopPowerColor(stopPower) }}
            >
              {stopPower.toFixed(1)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Stop Power
            </div>
          </div>

          {/* Colloquiality */}
          {colloqPct != null && (
            <div className="flex flex-col gap-1 min-w-[120px]">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Colloquiality
                </span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: colloqColor }}
                >
                  {colloquialityScore!.toFixed(1)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${colloqPct}%`, background: colloqColor }}
                />
              </div>
            </div>
          )}

          {/* Curiosity gap pill */}
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold self-start ${
              curiosityGap.present
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {curiosityGap.present ? "Curiosity gap present" : "No curiosity gap"}
          </div>
        </div>

        {/* Row 2: Frame strip (one cell per second) */}
        {perSecond.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
              Second-by-second
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(perSecond.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {perSecond.map((entry) => (
                <FrameCell key={`sec-${entry.second}`} entry={entry} onSeek={onSeek} />
              ))}
            </div>
          </div>
        )}

        {/* Row 3: First-second detail */}
        <div className="rounded-md border-l-4 border-l-amber-500 bg-muted/30 p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-1">
            First Second Detail
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
                  key={t}
                  className="rounded-full bg-amber-500/15 text-amber-700 px-2 py-0.5 text-[10px] font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Curiosity gap resolve link */}
        {curiosityGap.present && curiosityGap.resolvesAt != null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Curiosity gap resolves at</span>
            <button
              type="button"
              className="font-mono text-emerald-500 hover:underline focus:outline-none"
              onClick={() => onSeek?.(curiosityGap.resolvesAt ?? 0)}
            >
              {fmt(curiosityGap.resolvesAt)}
            </button>
          </div>
        )}

        {/* Curiosity description */}
        {curiosityGap.description && (
          <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-muted pl-3">
            {curiosityGap.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
