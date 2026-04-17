"use client";

import { Mic, Music, Volume2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Music = {
  genre?: string;
  mood?: string;
  energyCurve?: number[];
  beatSync?: string | boolean;
  drops?: string[];
};

type AudioExtended = {
  voiceoverTone?: string[];
  voiceoverPace?: string;
  voiceoverCadence?: number;
  audioDensity?: string;
  music?: Music;
  ambientSounds?: { timestamp?: number; description?: string; role?: string }[];
  soundEffects?: { timestamp?: number; sfx?: string; purpose?: string }[];
  silenceMoments?: {
    start?: number;
    end?: number;
    impact?: string;
    duration?: number;
  }[];
};

type Props = {
  audioExtended: AudioExtended;
};

function fmt(t?: number): string {
  if (t == null) {
    return "—";
  }
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function DensityBadge({ density }: { density?: string }) {
  if (!density) {
    return null;
  }
  const colors: Record<string, string> = {
    sparse: "bg-blue-500/15 text-blue-600",
    moderate: "bg-amber-500/15 text-amber-600",
    dense: "bg-red-500/15 text-red-600",
    layered: "bg-purple-500/15 text-purple-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[density] ?? "bg-muted text-muted-foreground"}`}
    >
      {density}
    </span>
  );
}

function PaceBadge({ pace }: { pace?: string }) {
  if (!pace) {
    return null;
  }
  const colors: Record<string, string> = {
    slow: "bg-blue-500/15 text-blue-600",
    measured: "bg-teal-500/15 text-teal-600",
    moderate: "bg-amber-500/15 text-amber-600",
    fast: "bg-red-500/15 text-red-600",
    "rapid-fire": "bg-red-500/15 text-red-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[pace] ?? "bg-muted text-muted-foreground"}`}
    >
      {pace}
    </span>
  );
}

export function AudioLandscapeExpanded({ audioExtended }: Props) {
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

  const energyCurveData = (music?.energyCurve ?? []).map((v, i) => ({
    i,
    energy: v,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audio Landscape</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: Voiceover */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Mic className="h-3.5 w-3.5" />
            Voiceover
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {voiceoverTone.map((tone, i) => (
              <span
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                key={`tone-${i}`}
              >
                {tone}
              </span>
            ))}
            {voiceoverPace && <PaceBadge pace={voiceoverPace} />}
            {audioDensity && <DensityBadge density={audioDensity} />}
            {voiceoverCadence != null && (
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold tabular-nums">
                  {voiceoverCadence}
                </span>
                <span className="text-xs text-muted-foreground">wpm</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Music */}
        {music && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Music className="h-3.5 w-3.5" />
              Music
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {music.genre && (
                <span className="rounded-md border px-2.5 py-1 text-xs font-medium">
                  {music.genre}
                </span>
              )}
              {music.mood && (
                <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
                  {music.mood}
                </span>
              )}
              {music.beatSync != null && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    music.beatSync === true || music.beatSync === "strong"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : music.beatSync === false || music.beatSync === "none"
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-500/15 text-amber-600"
                  }`}
                >
                  Beat sync: {String(music.beatSync)}
                </span>
              )}
              {music.drops && music.drops.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {music.drops.map((drop, i) => (
                    <span
                      className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs text-purple-600"
                      key={`drop-${i}`}
                    >
                      Drop: {drop}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {energyCurveData.length > 0 && (
              <ResponsiveContainer height={80} minWidth={280} width="100%">
                <AreaChart
                  data={energyCurveData}
                  margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="energy-grad"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#a855f7"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <Tooltip
                    contentStyle={{ fontSize: "11px" }}
                    formatter={(v) => [
                      typeof v === "number" ? v.toFixed(2) : v,
                      "Energy",
                    ]}
                    labelFormatter={(i) => `Beat ${Number(i) + 1}`}
                  />
                  <Area
                    dataKey="energy"
                    dot={false}
                    fill="url(#energy-grad)"
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Row 3: Ambient sounds */}
        {ambientSounds.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              Ambient sounds
            </div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 font-mono">Time</th>
                    <th className="px-3 py-1.5">Sound</th>
                    <th className="px-3 py-1.5">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {ambientSounds.map((s, i) => (
                    <tr className="border-b last:border-0" key={`ambient-${i}`}>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">
                        {fmt(s.timestamp)}
                      </td>
                      <td className="px-3 py-1.5">{s.description ?? "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {s.role ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Row 4: Sound effects */}
        {soundEffects.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sound effects
            </div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 font-mono">Time</th>
                    <th className="px-3 py-1.5">SFX</th>
                    <th className="px-3 py-1.5">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {soundEffects.map((s, i) => (
                    <tr className="border-b last:border-0" key={`sfx-${i}`}>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">
                        {fmt(s.timestamp)}
                      </td>
                      <td className="px-3 py-1.5">{s.sfx ?? "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {s.purpose ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Row 5: Silence moments */}
        {silenceMoments.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Silence moments
            </div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 font-mono">Range</th>
                    <th className="px-3 py-1.5">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {silenceMoments.map((s, i) => {
                    const range =
                      s.start != null && s.end != null
                        ? `${fmt(s.start)} – ${fmt(s.end)}`
                        : s.duration == null
                          ? "—"
                          : `${s.duration}s`;
                    return (
                      <tr
                        className="border-b last:border-0"
                        key={`silence-${i}`}
                      >
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">
                          {range}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {s.impact ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {ambientSounds.length === 0 &&
          soundEffects.length === 0 &&
          silenceMoments.length === 0 &&
          !music &&
          voiceoverTone.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No detailed audio landscape data available.
            </p>
          )}
      </CardContent>
    </Card>
  );
}
