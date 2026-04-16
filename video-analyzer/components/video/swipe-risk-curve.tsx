"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  swipeRiskCurve: AnalysisExtended["swipeRiskCurve"];
};

export function SwipeRiskCurve({ swipeRiskCurve }: Props) {
  if (swipeRiskCurve.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Swipe-risk curve</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          No per-second risk data.
        </CardContent>
      </Card>
    );
  }

  const data = swipeRiskCurve.map((pt) => ({
    t: pt.second,
    risk: pt.risk,
    reason: pt.reason,
  }));

  const peak = data.reduce((acc, d) => (d.risk > acc.risk ? d : acc), data[0]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Swipe-risk curve</CardTitle>
        <span className="text-muted-foreground text-xs">
          peak {peak.risk.toFixed(1)} @ {peak.t.toFixed(1)}s
        </span>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: 200, minWidth: 280 }}>
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={data}>
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="t"
                fontSize={10}
                tickFormatter={(v) => `${v.toFixed(0)}s`}
              />
              <YAxis domain={[0, 10]} fontSize={10} width={24} />
              <ReferenceLine stroke="#ef4444" strokeDasharray="3 3" y={7} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value, _name, ctx) => {
                  const reason =
                    (ctx?.payload as { reason?: string } | undefined)?.reason ??
                    "";
                  return [`${Number(value).toFixed(1)} — ${reason}`, "risk"];
                }}
                labelFormatter={(v) => `t=${v}s`}
              />
              <Line
                dataKey="risk"
                dot={false}
                isAnimationActive={false}
                stroke="#ef4444"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
