"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EyeContactScene = {
  start: number;
  end: number;
  pct: number;
};

type EyeContact = {
  overallScore: number;
  directAddressPct: number;
  perScene: EyeContactScene[];
};

type Props = {
  eyeContact: EyeContact;
};

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function scoreColor(score: number): string {
  if (score >= 7) return "#22c55e";
  if (score >= 4) return "#f59e0b";
  return "#ef4444";
}

function DonutSegment({
  pct,
  color,
  label,
}: {
  pct: number;
  color: string;
  label: string;
}) {
  // Simple CSS-based donut
  const clamped = Math.max(0, Math.min(1, pct));
  const deg = Math.round(clamped * 360);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative h-16 w-16 rounded-full"
        style={{
          background: `conic-gradient(${color} ${deg}deg, #e2e8f0 ${deg}deg)`,
        }}
      >
        <div className="absolute inset-[6px] rounded-full bg-background flex items-center justify-center">
          <span className="text-[11px] font-bold tabular-nums">
            {Math.round(clamped * 100)}%
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

export function EyeContactChart({ eyeContact }: Props) {
  if (!eyeContact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eye Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No eye contact data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { overallScore, directAddressPct, perScene } = eyeContact;

  const chartData = perScene.map((s, i) => ({
    name: fmt(s.start),
    pct: Math.round(s.pct * 100),
    scene: i + 1,
    start: s.start,
    end: s.end,
  }));

  const color = scoreColor(overallScore);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Eye Contact</CardTitle>
          <div className="flex items-baseline gap-1">
            <span
              className="text-3xl font-bold tabular-nums"
              style={{ color }}
            >
              {overallScore.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">/10</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Donuts row */}
        <div className="flex justify-around">
          <DonutSegment
            color={color}
            label="Direct address"
            pct={directAddressPct}
          />
          <div className="flex flex-col items-center gap-1 justify-center">
            <div
              className="text-4xl font-bold tabular-nums"
              style={{ color }}
            >
              {overallScore.toFixed(1)}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Overall score
            </span>
          </div>
          <DonutSegment
            color="#64748b"
            label="No eye contact"
            pct={1 - directAddressPct}
          />
        </div>

        {/* Per-scene area chart */}
        {chartData.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Per-scene eye contact %
            </div>
            <ResponsiveContainer height={120} width="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient
                    id="eyeGrad"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "11px",
                    padding: "6px 10px",
                  }}
                  formatter={(value) => [`${value}%`, "Eye contact"]}
                  labelFormatter={(label, payload) => {
                    const d = payload?.[0]?.payload;
                    return d
                      ? `Scene ${d.scene} (${fmt(d.start)}–${fmt(d.end)})`
                      : label;
                  }}
                />
                <Area
                  dataKey="pct"
                  fill="url(#eyeGrad)"
                  stroke={color}
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
