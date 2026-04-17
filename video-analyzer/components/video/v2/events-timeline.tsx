"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

type Props = {
  patternInterrupts?: PatternInterrupt[] | null;
  trustSignals?: TrustSignal[] | null;
  microMoments?: MicroMoment[] | null;
  totalDuration: number;
  onSeek?: (time: number) => void;
};

const LANE_COLOR = {
  interrupts: "#f59e0b",
  trust: "#10b981",
  moments: "#a855f7",
} as const;

const LANE_LABEL = {
  interrupts: "Interrupts",
  trust: "Trust",
  moments: "Moments",
} as const;

const LANE_HEIGHT = 18;
const LANE_GAP = 8;
const DOT_MAX = 10;
const DOT_MIN = 5;

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type LaneKey = keyof typeof LANE_COLOR;

type DotEvent = {
  lane: LaneKey;
  timestamp: number;
  label: string;
  detail: string;
  score: number | null;
  scoreLabel: string;
};

type TooltipState = {
  event: DotEvent;
  leftPct: number;
  laneIndex: number;
};

function scoreToRadius(score: number | null): number {
  if (score == null) return (DOT_MAX + DOT_MIN) / 2;
  const norm = Math.max(0, Math.min(10, score)) / 10;
  return DOT_MIN + norm * (DOT_MAX - DOT_MIN);
}

function LaneDots({
  events,
  dur,
  color,
  onHover,
  onLeave,
  onSeek,
}: {
  events: DotEvent[];
  dur: number;
  color: string;
  onHover: (e: DotEvent, leftPct: number, laneIndex: number, idx: number) => void;
  onLeave: () => void;
  onSeek?: (t: number) => void;
}) {
  return (
    <>
      {events.map((ev, i) => {
        const leftPct = (ev.timestamp / dur) * 100;
        const r = scoreToRadius(ev.score);
        const laneKeys: LaneKey[] = ["interrupts", "trust", "moments"];
        const laneIndex = laneKeys.indexOf(ev.lane);
        return (
          <button
            key={`${ev.lane}-${i}-${ev.timestamp}`}
            type="button"
            onClick={() => onSeek?.(ev.timestamp)}
            onMouseEnter={() => onHover(ev, leftPct, laneIndex, i)}
            onMouseLeave={onLeave}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer transition-all hover:brightness-125 focus:outline-none focus-visible:ring-2"
            style={{
              left: `${leftPct}%`,
              top: "50%",
              width: `${r * 2}px`,
              height: `${r * 2}px`,
              background: color,
              opacity: 0.85,
            }}
          />
        );
      })}
    </>
  );
}

export function EventsTimeline({
  patternInterrupts,
  trustSignals,
  microMoments,
  totalDuration,
  onSeek,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const interrupts = patternInterrupts ?? [];
  const trust = trustSignals ?? [];
  const moments = microMoments ?? [];

  const hasAny = interrupts.length > 0 || trust.length > 0 || moments.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timed Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No events detected.</p>
        </CardContent>
      </Card>
    );
  }

  const dur = totalDuration > 0 ? totalDuration : 1;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    pct: f * 100,
    label: fmt(f * dur),
  }));

  const lanes: { key: LaneKey; events: DotEvent[] }[] = [
    {
      key: "interrupts",
      events: interrupts.map((e) => ({
        lane: "interrupts" as LaneKey,
        timestamp: e.timestamp,
        label: e.type,
        detail: e.description,
        score: e.effectiveness,
        scoreLabel: "Effectiveness",
      })),
    },
    {
      key: "trust",
      events: trust.map((e) => ({
        lane: "trust" as LaneKey,
        timestamp: e.timestamp,
        label: e.type,
        detail: e.description,
        score: e.strength,
        scoreLabel: "Strength",
      })),
    },
    {
      key: "moments",
      events: moments.map((e) => ({
        lane: "moments" as LaneKey,
        timestamp: e.timestamp,
        label: e.kind,
        detail: e.description,
        score: null,
        scoreLabel: e.impactOnRetention,
      })),
    },
  ];

  const LANE_ROW_HEIGHT = 40;
  const TRACK_HEIGHT = LANE_ROW_HEIGHT * 3 + LANE_GAP * 2;
  const LABEL_INSET = 96; // px of lane width reserved for label

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Timed Events</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {interrupts.length + trust.length + moments.length} events · {fmt(dur)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Track area — labels are anchored INSIDE each lane (like a video editor) */}
        <div className="relative">
          <div className="relative" style={{ height: `${TRACK_HEIGHT}px` }}>
            {lanes.map((lane, li) => (
              <div
                key={lane.key}
                className="absolute left-0 right-0 rounded border bg-muted/20 overflow-visible"
                style={{
                  top: li * (LANE_ROW_HEIGHT + LANE_GAP),
                  height: `${LANE_ROW_HEIGHT}px`,
                }}
              >
                {/* Lane label pinned to the left. Use explicit flex centering
                    instead of top-1/2 + translate (tailwind compat pitfall
                    with some Next 16 builds where the transform didn't
                    actually apply). */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 pr-2 z-[1]"
                  style={{ width: `${LABEL_INSET}px` }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: LANE_COLOR[lane.key] }}
                  >
                    {LANE_LABEL[lane.key]}
                  </span>
                </div>
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: `${LABEL_INSET}px`,
                    right: 0,
                  }}
                >
                  <LaneDots
                    events={lane.events}
                    dur={dur}
                    color={LANE_COLOR[lane.key]}
                    onHover={(ev, leftPct, laneIndex) =>
                      setTooltip({ event: ev, leftPct, laneIndex })
                    }
                    onLeave={() => setTooltip(null)}
                    onSeek={onSeek}
                  />
                </div>
              </div>
            ))}

              {/* Tooltip — floats above the track so it never pushes
                  surrounding layout. leftPct is in the dot-track coordinate
                  space, so we offset by LABEL_INSET to align with the pointer. */}
              {tooltip && (
                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: `calc(${LABEL_INSET}px + clamp(0px, ${tooltip.leftPct}% , calc(100% - ${LABEL_INSET}px - 240px)))`,
                    bottom: "100%",
                    marginBottom: "10px",
                  }}
                >
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl max-w-[240px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: LANE_COLOR[tooltip.event.lane] }}
                      />
                      <span className="font-semibold capitalize">
                        {tooltip.event.label}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {fmt(tooltip.event.timestamp)}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-snug mb-1">
                      {tooltip.event.detail}
                    </p>
                    {tooltip.event.score != null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {tooltip.event.scoreLabel}
                        </span>
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(tooltip.event.score / 10) * 100}%`,
                              background: LANE_COLOR[tooltip.event.lane],
                            }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums">
                          {tooltip.event.score.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground italic">
                        {tooltip.event.scoreLabel}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          {/* Time axis — offset by label inset so ticks align with dots */}
          <div
            className="relative h-4 mt-1"
            style={{ marginLeft: `${LABEL_INSET}px` }}
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
      </CardContent>
    </Card>
  );
}
