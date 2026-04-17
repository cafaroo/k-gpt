"use client";

import { useCallback, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Beat = {
  type: string;
  start: number;
  end: number;
  description: string;
  strength: number;
};
type Scene = {
  start: number;
  end: number;
  label: string;
  function: string;
  description: string;
};
type SwipeRiskPt = { second: number; risk: number; reason: string };
type EmotionPt = {
  timestamp: number;
  primary: string;
  intensity: number;
  note?: string;
};
type PatternInterrupt = {
  timestamp: number;
  type: string;
  description: string;
  effectiveness: number;
};
type TrustSignal = {
  timestamp: number;
  type: string;
  description: string;
  strength: number;
};
type MicroMoment = {
  timestamp: number;
  kind: string;
  description: string;
  impactOnRetention: string;
};

type VideoRow = { blobUrl: string; filename?: string };

type FullPayload = {
  beatMap?: Beat[];
  scenes?: Scene[];
  extended?: {
    swipeRiskCurve?: SwipeRiskPt[];
    emotionalArc?: EmotionPt[];
    patternInterrupts?: PatternInterrupt[];
    trustSignals?: TrustSignal[];
    microMoments?: MicroMoment[];
  };
};

type Props = {
  video: VideoRow;
  fullPayload: FullPayload | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findCurrent<T>(
  arr: T[],
  time: number,
  getStart: (item: T) => number,
  getEnd: (item: T) => number
): T | undefined {
  return arr.find((item) => getStart(item) <= time && time < getEnd(item));
}

function findNearest<T>(
  arr: T[],
  time: number,
  getTimestamp: (item: T) => number,
  tolerance: number
): T | undefined {
  let best: T | undefined;
  let bestDist = tolerance + 1;
  for (const item of arr) {
    const dist = Math.abs(getTimestamp(item) - time);
    if (dist <= tolerance && dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}

function sceneFunctionColor(fn: string): string {
  const map: Record<string, string> = {
    hook: "bg-emerald-500/20 text-emerald-600 border-emerald-500/40",
    problem: "bg-red-500/20 text-red-600 border-red-500/40",
    "product-intro": "bg-blue-500/20 text-blue-600 border-blue-500/40",
    "social-proof": "bg-purple-500/20 text-purple-600 border-purple-500/40",
    demo: "bg-cyan-500/20 text-cyan-600 border-cyan-500/40",
    benefit: "bg-teal-500/20 text-teal-600 border-teal-500/40",
    cta: "bg-orange-500/20 text-orange-600 border-orange-500/40",
    transition: "bg-muted/40 text-muted-foreground border-border",
    other: "bg-muted/40 text-muted-foreground border-border",
  };
  return map[fn] ?? "bg-muted/40 text-muted-foreground border-border";
}

function emotionEmoji(primary: string): string {
  const map: Record<string, string> = {
    curiosity: "?",
    excitement: "!",
    trust: "V",
    surprise: "*",
    fear: "!",
    joy: ":)",
    sadness: ":(",
    anticipation: "...",
    disgust: "X",
    anger: ">",
  };
  return map[primary.toLowerCase()] ?? "~";
}

const TICK_TYPE_COLOR: Record<string, string> = {
  beat: "#3b82f6",
  interrupt: "#f59e0b",
  trust: "#10b981",
  moment: "#a855f7",
};

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Timeline tick types ──────────────────────────────────────────────────────

type Tick = {
  time: number;
  type: "beat" | "interrupt" | "trust" | "moment";
  label: string;
  description: string;
};

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoWithOverlay({ video, fullPayload }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoveredTick, setHoveredTick] = useState<Tick | null>(null);
  const [hoveredTickPct, setHoveredTickPct] = useState(0);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const beatMap = fullPayload?.beatMap ?? [];
  const scenes = fullPayload?.scenes ?? [];
  const swipeRiskCurve = fullPayload?.extended?.swipeRiskCurve ?? [];
  const emotionalArc = fullPayload?.extended?.emotionalArc ?? [];
  const patternInterrupts = fullPayload?.extended?.patternInterrupts ?? [];
  const trustSignals = fullPayload?.extended?.trustSignals ?? [];
  const microMoments = fullPayload?.extended?.microMoments ?? [];

  const currentBeat = findCurrent(
    beatMap,
    currentTime,
    (b) => b.start,
    (b) => b.end
  );
  const currentScene = findCurrent(
    scenes,
    currentTime,
    (s) => s.start,
    (s) => s.end
  );
  const nearbyInterrupt = findNearest(
    patternInterrupts,
    currentTime,
    (p) => p.timestamp,
    0.5
  );
  const nearbyTrust = findNearest(
    trustSignals,
    currentTime,
    (t) => t.timestamp,
    0.5
  );
  const nearbyMoment = findNearest(
    microMoments,
    currentTime,
    (m) => m.timestamp,
    0.5
  );

  const nearestEmotion =
    emotionalArc.length > 0
      ? emotionalArc.reduce((acc, e) =>
          Math.abs(e.timestamp - currentTime) <
          Math.abs(acc.timestamp - currentTime)
            ? e
            : acc
        )
      : null;

  const nearestRisk =
    swipeRiskCurve.length > 0
      ? swipeRiskCurve.reduce((acc, r) =>
          Math.abs(r.second - currentTime) < Math.abs(acc.second - currentTime)
            ? r
            : acc
        )
      : null;

  // Build timeline ticks
  const ticks: Tick[] = [];
  for (const b of beatMap) {
    ticks.push({
      time: b.start,
      type: "beat",
      label: b.type,
      description: b.description,
    });
  }
  for (const p of patternInterrupts) {
    ticks.push({
      time: p.timestamp,
      type: "interrupt",
      label: p.type,
      description: p.description,
    });
  }
  for (const t of trustSignals) {
    ticks.push({
      time: t.timestamp,
      type: "trust",
      label: t.type,
      description: t.description,
    });
  }
  for (const m of microMoments) {
    ticks.push({
      time: m.timestamp,
      type: "moment",
      label: m.kind,
      description: m.description,
    });
  }

  // Swipe-risk mini gauge ring
  const risk = nearestRisk?.risk ?? 0;
  const riskPct = risk / 10;
  const circum = 2 * Math.PI * 18;
  const riskDash = circum * riskPct;
  const riskColor = risk >= 7 ? "#ef4444" : risk >= 4 ? "#f59e0b" : "#10b981";

  return (
    <div className="space-y-3">
      {/* Video + live overlay panel */}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        {/* Video with floating callouts */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-[9/16] md:aspect-video">
          {/* biome-ignore lint/a11y/useMediaCaption: no caption for POC */}
          <video
            className="h-full w-full object-contain"
            controls
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            ref={videoRef}
            src={video.blobUrl}
          />

          {/* Floating callouts — absolute so they don't push layout */}
          <div className="pointer-events-none absolute top-3 right-3 flex flex-col gap-2 max-w-[240px] z-10">
            {nearbyInterrupt && (
              <div className="rounded-md border border-amber-500/60 bg-amber-950/85 backdrop-blur-sm px-3 py-2 shadow-lg animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="text-[10px] uppercase tracking-wide text-amber-300 mb-0.5">
                  Pattern interrupt
                </div>
                <div className="text-xs font-semibold text-amber-200">
                  {nearbyInterrupt.type}
                </div>
                <p className="text-[10px] text-amber-100/80 mt-0.5 leading-snug line-clamp-2">
                  {nearbyInterrupt.description}
                </p>
              </div>
            )}
            {nearbyTrust && (
              <div className="rounded-md border border-emerald-500/60 bg-emerald-950/85 backdrop-blur-sm px-3 py-2 shadow-lg animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="text-[10px] uppercase tracking-wide text-emerald-300 mb-0.5">
                  Trust signal
                </div>
                <div className="text-xs font-semibold text-emerald-200">
                  {nearbyTrust.type}
                </div>
                <p className="text-[10px] text-emerald-100/80 mt-0.5 leading-snug line-clamp-2">
                  {nearbyTrust.description}
                </p>
              </div>
            )}
            {nearbyMoment && (
              <div className="rounded-md border border-purple-500/60 bg-purple-950/85 backdrop-blur-sm px-3 py-2 shadow-lg animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="text-[10px] uppercase tracking-wide text-purple-300 mb-0.5">
                  Micro-moment
                </div>
                <div className="text-xs font-semibold text-purple-200">
                  {nearbyMoment.kind}
                </div>
                <p className="text-[10px] text-purple-100/80 mt-0.5 leading-snug line-clamp-2">
                  {nearbyMoment.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Live panel */}
        <div className="space-y-3 overflow-y-auto max-h-[400px] md:max-h-none">
          {/* Timestamp */}
          <div className="rounded-lg border px-3 py-2 flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums">
              {fmt(currentTime)}
            </span>
            {duration > 0 && (
              <span className="text-muted-foreground text-xs">
                / {fmt(duration)}
              </span>
            )}
          </div>

          {/* Swipe risk gauge */}
          {nearestRisk && (
            <div className="rounded-lg border px-3 py-2 flex items-center gap-3">
              <svg
                className="-rotate-90 h-12 w-12 shrink-0"
                viewBox="0 0 44 44"
              >
                <circle
                  cx="22"
                  cy="22"
                  fill="none"
                  r="18"
                  stroke="hsl(var(--border))"
                  strokeWidth="5"
                />
                <circle
                  cx="22"
                  cy="22"
                  fill="none"
                  r="18"
                  stroke={riskColor}
                  strokeDasharray={`${riskDash} ${circum}`}
                  strokeLinecap="round"
                  strokeWidth="5"
                />
              </svg>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Swipe risk
                </div>
                <div
                  className="text-xl font-semibold tabular-nums"
                  style={{ color: riskColor }}
                >
                  {risk.toFixed(1)}
                  <span className="text-xs text-muted-foreground">/10</span>
                </div>
                <div className="text-[10px] text-muted-foreground line-clamp-2">
                  {nearestRisk.reason}
                </div>
              </div>
            </div>
          )}

          {/* Current emotion */}
          {nearestEmotion && (
            <div className="rounded-lg border px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Emotion
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg">
                  {emotionEmoji(nearestEmotion.primary)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium capitalize">
                    {nearestEmotion.primary}
                  </div>
                  <div className="bg-muted mt-1 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${(nearestEmotion.intensity / 10) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {nearestEmotion.intensity.toFixed(1)}/10 intensity
                  </div>
                </div>
              </div>
              {nearestEmotion.note && (
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  {nearestEmotion.note}
                </p>
              )}
            </div>
          )}

          {/* Current beat */}
          {currentBeat && (
            <div className="rounded-lg border px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Beat
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                {currentBeat.type}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {currentBeat.description}
              </p>
              <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                {fmt(currentBeat.start)} – {fmt(currentBeat.end)}
              </div>
            </div>
          )}

          {/* Current scene */}
          {currentScene && (
            <div
              className={`rounded-lg border px-3 py-2 ${sceneFunctionColor(currentScene.function)}`}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                Scene
              </div>
              <div className="text-xs font-semibold">{currentScene.label}</div>
              <div className="text-[10px] uppercase tracking-wide opacity-70">
                {currentScene.function}
              </div>
              <p className="text-[10px] leading-snug opacity-80 mt-0.5 line-clamp-2">
                {currentScene.description}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Multi-lane timeline */}
      {duration > 0 && ticks.length > 0 && (
        <div className="space-y-2">
          {/* Legend */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-mono">0:00</span>
            <span className="flex gap-3">
              {Object.entries(TICK_TYPE_COLOR).map(([type, color]) => (
                <span className="flex items-center gap-1" key={type}>
                  <span
                    className="h-2 w-2 rounded-sm inline-block"
                    style={{ background: color }}
                  />
                  {type}
                </span>
              ))}
            </span>
            <span className="font-mono">{fmt(duration)}</span>
          </div>

          {/* Track container with playhead + 2 lanes */}
          <div className="relative rounded-md border bg-muted/20 overflow-visible">
            {/* Playhead spans all lanes */}
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white/70"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />

            {/* Lane 1: Beats as proportional bars */}
            <div
              className="relative border-b border-border/30"
              style={{ height: "20px" }}
            >
              <div className="absolute top-1/2 left-2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-muted-foreground/60 font-medium pointer-events-none z-[1]">
                Beats
              </div>
              {beatMap.map((b, i) => {
                const leftPct = (b.start / duration) * 100;
                const widthPct = Math.max(
                  0.4,
                  ((b.end - b.start) / duration) * 100
                );
                const color = TICK_TYPE_COLOR.beat;
                return (
                  <button
                    className="absolute top-1/2 -translate-y-1/2 h-3 rounded-[2px] cursor-pointer transition-all hover:brightness-125 hover:h-3.5 focus:outline-none"
                    key={`beat-bar-${i}-${b.start}`}
                    onClick={() => seekTo(b.start)}
                    onMouseEnter={() => {
                      setHoveredTick({
                        time: b.start,
                        type: "beat",
                        label: b.type,
                        description: b.description,
                      });
                      setHoveredTickPct(leftPct + widthPct / 2);
                    }}
                    onMouseLeave={() => setHoveredTick(null)}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: color,
                      opacity: 0.85,
                      minWidth: "2px",
                    }}
                    title={`${fmt(b.start)} · ${b.type}`}
                    type="button"
                  />
                );
              })}
            </div>

            {/* Lane 2: Events (interrupts + trust + moments) as dots */}
            <div className="relative" style={{ height: "20px" }}>
              <div className="absolute top-1/2 left-2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-muted-foreground/60 font-medium pointer-events-none z-[1]">
                Events
              </div>
              {ticks
                .filter((t) => t.type !== "beat")
                .map((tick, i) => {
                  const pct = (tick.time / duration) * 100;
                  const color = TICK_TYPE_COLOR[tick.type];
                  return (
                    <button
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full cursor-pointer transition-all hover:scale-125 focus:outline-none"
                      key={`event-${tick.type}-${i}-${tick.time}`}
                      onClick={() => seekTo(tick.time)}
                      onMouseEnter={() => {
                        setHoveredTick(tick);
                        setHoveredTickPct(pct);
                      }}
                      onMouseLeave={() => setHoveredTick(null)}
                      style={{
                        left: `${pct}%`,
                        background: color,
                        boxShadow: `0 0 0 2px ${color}33`,
                      }}
                      title={`${fmt(tick.time)} · ${tick.label}`}
                      type="button"
                    />
                  );
                })}
            </div>

            {/* Hover tooltip */}
            {hoveredTick && (
              <div
                className="absolute bottom-full mb-2 z-20 pointer-events-none"
                style={{
                  left: `clamp(8px, ${hoveredTickPct}%, calc(100% - 180px))`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-xl max-w-[220px]">
                  <div className="font-mono text-[10px] text-muted-foreground mb-0.5">
                    {fmt(hoveredTick.time)} · {hoveredTick.type}
                  </div>
                  <div className="font-semibold capitalize">
                    {hoveredTick.label}
                  </div>
                  <div className="text-muted-foreground leading-snug line-clamp-2">
                    {hoveredTick.description}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
