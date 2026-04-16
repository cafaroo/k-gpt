"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  emotionalArc: AnalysisExtended["emotionalArc"];
  onSeek?: (time: number) => void;
};

export function EmotionalArcChart({ emotionalArc, onSeek }: Props) {
  if (emotionalArc.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Emotional arc</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          No emotional arc data.
        </CardContent>
      </Card>
    );
  }

  const data = emotionalArc.map((pt) => ({
    t: pt.timestamp,
    i: pt.intensity,
    primary: pt.primary,
    note: pt.note,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Emotional arc</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div style={{ width: "100%", height: 160, minWidth: 280 }}>
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="emoGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                fontSize={10}
                tickFormatter={(v) => `${v.toFixed(0)}s`}
              />
              <YAxis domain={[0, 10]} fontSize={10} width={24} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value, _name, ctx) => {
                  const primary =
                    (ctx?.payload as { primary?: string } | undefined)
                      ?.primary ?? "";
                  return [
                    `${Number(value).toFixed(1)} · ${primary}`,
                    "intensity",
                  ];
                }}
                labelFormatter={(v) => `t=${v}s`}
              />
              <Area
                dataKey="i"
                fill="url(#emoGrad)"
                isAnimationActive={false}
                stroke="#f59e0b"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {data.map((d) => (
            <button
              className="hover:bg-muted/60 rounded bg-muted/30 px-2 py-0.5 text-[11px]"
              key={`emo-${d.t}-${d.primary}`}
              onClick={() => onSeek?.(d.t)}
              type="button"
            >
              <span className="text-muted-foreground">{d.t.toFixed(0)}s</span>{" "}
              {d.primary}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
