"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scoreDistribution } from "@/lib/video/batch/insights";
import type { VideoJob } from "@/lib/video/batch/types";

type Props = {
  videos: VideoJob[];
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

export function BatchDistribution({ videos }: Props) {
  const data = scoreDistribution(videos);
  const total = data.reduce((acc, d) => acc + d.count, 0);
  if (total === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Score distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer height={160} minWidth={240} width="100%">
          <BarChart data={data}>
            <XAxis
              dataKey="bucket"
              fontSize={11}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              allowDecimals={false}
              fontSize={11}
              stroke="hsl(var(--muted-foreground))"
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="count"
              isAnimationActive={false}
              radius={[4, 4, 0, 0]}
            >
              {data.map((d, idx) => (
                <Cell fill={COLORS[idx]} key={d.bucket} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
