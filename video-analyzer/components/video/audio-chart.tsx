"use client";

import { forwardRef } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AudioSegment } from "@/lib/video/types";

type Props = {
  segments: AudioSegment[];
};

export const AudioChart = forwardRef<HTMLDivElement, Props>(function AudioChart(
  { segments },
  ref
) {
  const data = segments.map((s) => ({
    t: s.startTime,
    rms: Math.max(-60, s.rmsLevel),
  }));

  return (
    <div className="bg-background h-48 w-full rounded-lg border p-2" ref={ref}>
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="rmsGrad" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.6}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            fontSize={10}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => `${v.toFixed(0)}s`}
          />
          <YAxis
            domain={[-60, 0]}
            fontSize={10}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => `${v} dB`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Area
            dataKey="rms"
            fill="url(#rmsGrad)"
            isAnimationActive={false}
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
