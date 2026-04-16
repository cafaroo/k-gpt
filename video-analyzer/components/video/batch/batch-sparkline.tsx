"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

type Props = {
  data: { time: number; intensity: number }[];
  color?: string;
  width?: number;
  height?: number;
};

export function BatchSparkline({
  data,
  color = "hsl(var(--primary))",
  width = 100,
  height = 24,
}: Props) {
  if (data.length === 0) {
    return null;
  }
  return (
    <ResponsiveContainer height={height} width={width}>
      <AreaChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area
          dataKey="intensity"
          fill="url(#sparkGrad)"
          isAnimationActive={false}
          stroke={color}
          strokeWidth={1.5}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
