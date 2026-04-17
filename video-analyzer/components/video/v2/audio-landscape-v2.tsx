"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

// ── Types ──────────────────────────────────────────────────────────────────────

type EnergyCurvePoint = { time: number; energy: number };
type MusicDrop = { timestamp: number; effect?: string };

type MusicData = {
  genre?: string;
  mood?: string;
  beatSync?: string | boolean;
  energyCurve?: EnergyCurvePoint[] | number[];
  drops?: MusicDrop[];
};

type AmbientSound = {
  start: number;
  end: number;
  description: string;
  role?: string;
};

type SoundEffect = {
  timestamp: number;
  sfx: string;
  purpose?: string;
};

type SilenceMoment = {
  start: number;
  end: number;
  impact?: string;
};

type AudioExtended = {
  voiceoverTone?: string[];
  voiceoverPace?: string;
  voiceoverCadence?: number;
  audioDensity?: string;
  music?: MusicData;
  ambientSounds?: AmbientSound[];
  soundEffects?: SoundEffect[];
  silenceMoments?: SilenceMoment[];
};

type Props = {
  audioExtended: AudioExtended;
  totalDuration: number;
  onSeek?: (time: number) => void;
};

// ── Palette ────────────────────────────────────────────────────────────────────

const AMBIENT_ROLE_COLOR: Record<string, string> = {
  atmosphere: "#64748b",
  "realism-cue": "#3b82f6",
  distraction: "#ef4444",
  "narrative-element": "#a855f7",
};

function ambientColor(role?: string): string {
  return AMBIENT_ROLE_COLOR[role ?? ""] ?? "#64748b";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PaceBadge({ pace }: { pace?: string }) {
  if (!pace) return null;
  const colors: Record<string, string> = {
    slow: "bg-blue-500/15 text-blue-600",
    measured: "bg-teal-500/15 text-teal-600",
    moderate: "bg-amber-500/15 text-amber-600",
    fast: "bg-red-500/15 text-red-600",
    "rapid-fire": "bg-red-500/15 text-red-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[pace] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {pace}
    </span>
  );
}

function DensityBadge({ density }: { density?: string }) {
  if (!density) return null;
  const colors: Record<string, string> = {
    sparse: "bg-blue-500/15 text-blue-600",
    moderate: "bg-amber-500/15 text-amber-600",
    dense: "bg-red-500/15 text-red-600",
    layered: "bg-purple-500/15 text-purple-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[density] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {density}
    </span>
  );
}

function EmptyBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
      No {label}
    </span>
  );
}

// ── Normalize energy curve (may be number[] or {time,energy}[]) ───────────────
function normalizeEnergyCurve(
  raw: MusicData["energyCurve"],
  dur: number
): { t: number; energy: number }[] {
  if (!raw || raw.length === 0) return [];
  if (typeof raw[0] === "number") {
    const nums = raw as number[];
    return nums.map((e, i) => ({
      t: (i / Math.max(nums.length - 1, 1)) * dur,
      energy: e,
    }));
  }
  return (raw as EnergyCurvePoint[]).map((p) => ({ t: p.time, energy: p.energy }));
}

// ── Tooltip state ──────────────────────────────────────────────────────────────

type TooltipInfo = {
  leftPct: number;
  topPx: number;
  text: string;
  timestamp: number;
};

// ── Timeline constants ─────────────────────────────────────────────────────────

const LANE_H = 20;
const LANE_KEYS = ["sfx", "ambient", "silence", "drops"] as const;

// ── Main component ─────────────────────────────────────────────────────────────

export function AudioLandscapeV2({ audioExtended, totalDuration, onSeek }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const {
    voiceoverTone = [],
    voiceoverPace,
    voiceoverCadence,
    audioDensity,
    music,
    ambientSounds = [],
    soundEffects = [],
    silenceMoments = [],
  } = audioExtended;

  const dur = totalDuration > 0 ? totalDuration : 1;
  const energyPoints = normalizeEnergyCurve(music?.energyCurve, dur);
  const drops = music?.drops ?? [];

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    pct: f * 100,
    label: fmt(f * dur),
  }));

  // 4 lanes: sfx, ambient, silence, drops
  const TRACK_LANES = 4;
  const TRACK_H = LANE_H * TRACK_LANES + 4 * (TRACK_LANES - 1); // 4px gap

  function laneTop(idx: number): number {
    return idx * (LANE_H + 4);
  }

  function showTooltip(
    leftPct: number,
    laneIdx: number,
    text: string,
    timestamp: number
  ) {
    setTooltip({ leftPct, topPx: laneTop(laneIdx) + LANE_H, text, timestamp });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audio Landscape</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary row */}
        <div className="flex flex-wrap items-center gap-2">
          {voiceoverTone.map((tone, i) => (
            <span
              key={`tone-${i}`}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {tone}
            </span>
          ))}
          {voiceoverPace && <PaceBadge pace={voiceoverPace} />}
          {audioDensity && <DensityBadge density={audioDensity} />}
          {voiceoverCadence != null && (
            <div className="flex items-center gap-1">
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-bold tabular-nums">{voiceoverCadence}</span>
                <span className="text-xs text-muted-foreground">syl/sec</span>
              </div>
              <InfoTooltip metricKey="voiceoverCadence" side="top" />
            </div>
          )}
          {music?.genre && (
            <span className="rounded-md border px-2.5 py-0.5 text-xs font-medium">
              {music.genre}
            </span>
          )}
          {music?.mood && (
            <span className="rounded-md border px-2.5 py-0.5 text-xs text-muted-foreground">
              {music.mood}
            </span>
          )}
        </div>

        {/* Unified audio timeline */}
        <div className="relative" style={{ height: `${TRACK_H + 30}px` }}>
          {/* Background: energy curve area */}
          {energyPoints.length > 1 && (
            <div
              className="absolute inset-x-0 top-0"
              style={{ height: `${TRACK_H}px`, pointerEvents: "none" }}
            >
              <ResponsiveContainer width="100%" height={TRACK_H}>
                <AreaChart
                  data={energyPoints.map((p) => ({
                    t: p.t,
                    energy: p.energy,
                  }))}
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="energy-bg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    dataKey="energy"
                    type="monotone"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    strokeOpacity={0.35}
                    fill="url(#energy-bg)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Track lanes overlay */}
          <div
            className="absolute inset-x-0 top-0 rounded-md border bg-muted/10 overflow-visible"
            style={{ height: `${TRACK_H}px` }}
          >
            {/* Lane 0: SFX dots (purple) */}
            <div
              className="absolute left-0 right-0"
              style={{ top: laneTop(0), height: LANE_H }}
            >
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-muted-foreground/60">
                SFX
              </span>
              {soundEffects.length === 0 && (
                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40">
                  —
                </span>
              )}
              {soundEffects.map((sfx, i) => {
                const leftPct = Math.min(99, (sfx.timestamp / dur) * 100);
                return (
                  <button
                    key={`sfx-${i}`}
                    type="button"
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer hover:brightness-125 focus:outline-none"
                    style={{
                      left: `${leftPct}%`,
                      top: "50%",
                      width: 8,
                      height: 8,
                      background: "#a855f7",
                      opacity: 0.85,
                    }}
                    onClick={() => onSeek?.(sfx.timestamp)}
                    onMouseEnter={() =>
                      showTooltip(
                        leftPct,
                        0,
                        `${sfx.sfx}${sfx.purpose ? ` — ${sfx.purpose}` : ""}`,
                        sfx.timestamp
                      )
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>

            {/* Lane 1: Ambient bars */}
            <div
              className="absolute left-0 right-0"
              style={{ top: laneTop(1), height: LANE_H }}
            >
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-muted-foreground/60 z-10">
                AMB
              </span>
              {ambientSounds.length === 0 && (
                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40">
                  —
                </span>
              )}
              {ambientSounds.map((amb, i) => {
                const leftPct = (amb.start / dur) * 100;
                const widthPct = Math.max(1, ((amb.end - amb.start) / dur) * 100);
                const color = ambientColor(amb.role);
                const centerPct = leftPct + widthPct / 2;
                return (
                  <button
                    key={`amb-${i}`}
                    type="button"
                    className="absolute top-1 cursor-pointer hover:brightness-110 focus:outline-none rounded-sm"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: LANE_H - 4,
                      background: color,
                      opacity: 0.35,
                    }}
                    onClick={() => onSeek?.(amb.start)}
                    onMouseEnter={() =>
                      showTooltip(
                        centerPct,
                        1,
                        `${amb.description}${amb.role ? ` (${amb.role})` : ""}`,
                        amb.start
                      )
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>

            {/* Lane 2: Silence bars (gray) */}
            <div
              className="absolute left-0 right-0"
              style={{ top: laneTop(2), height: LANE_H }}
            >
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-muted-foreground/60 z-10">
                SIL
              </span>
              {silenceMoments.length === 0 && (
                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40">
                  —
                </span>
              )}
              {silenceMoments.map((sil, i) => {
                const leftPct = (sil.start / dur) * 100;
                const widthPct = Math.max(1, ((sil.end - sil.start) / dur) * 100);
                const centerPct = leftPct + widthPct / 2;
                return (
                  <button
                    key={`sil-${i}`}
                    type="button"
                    className="absolute top-1 cursor-pointer hover:brightness-110 focus:outline-none rounded-sm"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: LANE_H - 4,
                      background: "#94a3b8",
                      opacity: 0.4,
                    }}
                    onClick={() => onSeek?.(sil.start)}
                    onMouseEnter={() =>
                      showTooltip(
                        centerPct,
                        2,
                        sil.impact ?? "Silence",
                        sil.start
                      )
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>

            {/* Lane 3: Music drops — pink diamond markers */}
            <div
              className="absolute left-0 right-0"
              style={{ top: laneTop(3), height: LANE_H }}
            >
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-muted-foreground/60 z-10">
                DROP
              </span>
              {drops.length === 0 && (
                <span className="absolute left-10 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40">
                  —
                </span>
              )}
              {drops.map((drop, i) => {
                const leftPct = Math.min(99, (drop.timestamp / dur) * 100);
                return (
                  <button
                    key={`drop-${i}`}
                    type="button"
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:brightness-125 focus:outline-none"
                    style={{
                      left: `${leftPct}%`,
                      top: "50%",
                      width: 10,
                      height: 10,
                      background: "#ec4899",
                      transform: "translateX(-50%) translateY(-50%) rotate(45deg)",
                      opacity: 0.9,
                    }}
                    onClick={() => onSeek?.(drop.timestamp)}
                    onMouseEnter={() =>
                      showTooltip(
                        leftPct,
                        3,
                        drop.effect ?? "Music drop",
                        drop.timestamp
                      )
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="pointer-events-none absolute z-30"
              style={{
                left: `clamp(8px, ${tooltip.leftPct}%, calc(100% - 200px))`,
                top: `${tooltip.topPx + 4}px`,
              }}
            >
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl max-w-[220px]">
                <div className="font-mono text-[10px] text-muted-foreground mb-0.5">
                  {fmt(tooltip.timestamp)}
                </div>
                <p className="text-muted-foreground leading-snug">{tooltip.text}</p>
              </div>
            </div>
          )}

          {/* Time axis */}
          <div
            className="absolute left-0 right-0"
            style={{ top: `${TRACK_H + 4}px`, height: 16 }}
          >
            {ticks.map((tick) => (
              <span
                key={tick.pct}
                className="absolute -translate-x-1/2 text-[10px] text-muted-foreground font-mono"
                style={{ left: `${tick.pct}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>

        {/* Empty-state badges */}
        {soundEffects.length === 0 &&
          ambientSounds.length === 0 &&
          silenceMoments.length === 0 &&
          drops.length === 0 &&
          energyPoints.length === 0 && (
            <div className="flex flex-wrap gap-2">
              <EmptyBadge label="SFX" />
              <EmptyBadge label="ambient sounds" />
              <EmptyBadge label="silence moments" />
              <EmptyBadge label="music drops" />
            </div>
          )}
      </CardContent>
    </Card>
  );
}
