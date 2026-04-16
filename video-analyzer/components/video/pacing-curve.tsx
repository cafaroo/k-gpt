"use client";

import { forwardRef } from "react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
};

export const PacingCurve = forwardRef<HTMLDivElement, Props>(
  function PacingCurve({ analysis }, ref) {
    const data = analysis.pacing.intensityCurve.map((pt) => ({
      t: pt.time,
      intensity: pt.intensity,
      note: pt.note,
    }));

    if (data.length === 0) {
      return (
        <Card ref={ref}>
          <CardHeader>
            <CardTitle className="text-sm">
              Engagement intensity curve
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Intensity-kurvan saknas från Gemini-output.
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Engagement intensity curve</CardTitle>
          <span className="text-muted-foreground text-xs">
            Qwen-predicted · 0–10 per second
          </span>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={224} minWidth={280} width="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="intensityGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                fontSize={10}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => `${v.toFixed(0)}s`}
              />
              <YAxis
                domain={[0, 10]}
                fontSize={10}
                stroke="hsl(var(--muted-foreground))"
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(v) => `t=${v}s`}
              />
              {analysis.pacing.deadSpots.map((ds) => (
                <ReferenceArea
                  fill="#ef4444"
                  fillOpacity={0.1}
                  key={`${ds.start}-${ds.end}`}
                  label={{ value: "dead", fontSize: 10, fill: "#ef4444" }}
                  x1={ds.start}
                  x2={ds.end}
                />
              ))}
              <Area
                dataKey="intensity"
                fill="url(#intensityGrad)"
                isAnimationActive={false}
                stroke="#3b82f6"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>

          {analysis.pacing.deadSpots.length > 0 && (
            <div className="text-muted-foreground mt-3 space-y-1 text-xs">
              <span className="font-medium">Dead spots:</span>
              {analysis.pacing.deadSpots.map((ds) => (
                <div key={`ds-${ds.start}-${ds.end}`}>
                  • {ds.start.toFixed(1)}–{ds.end.toFixed(1)}s — {ds.reason}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
