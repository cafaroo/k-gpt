"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Rule = {
  ruleId: string;
  title: string;
  met: boolean;
  score?: number;
  evidence: string;
};

type Props = {
  rules: Rule[];
};

// Shorten long rule titles for radar labels
function shortLabel(title: string): string {
  if (title.length <= 16) {
    return title;
  }
  return `${title.slice(0, 14)}…`;
}

export function RuleComplianceRadar({ rules }: Props) {
  if (!rules || rules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Rule compliance</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          No compliance data.
        </CardContent>
      </Card>
    );
  }

  const data = rules.map((r) => ({
    label: shortLabel(r.title),
    fullTitle: r.title,
    score: r.score ?? (r.met ? 8 : 2),
    max: 10,
    met: r.met,
    evidence: r.evidence,
  }));

  const metCount = rules.filter((r) => r.met).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Rule compliance</CardTitle>
          <span className="text-muted-foreground text-xs">
            {metCount}/{rules.length} met
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer height={240} width="100%">
          <RadarChart
            data={data}
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
          >
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 10]}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              tickCount={3}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value, _name, ctx) => {
                const payload = ctx?.payload as
                  | { fullTitle?: string; evidence?: string }
                  | undefined;
                return [
                  `${Number(value).toFixed(1)}/10${payload?.evidence ? ` — ${payload.evidence}` : ""}`,
                  payload?.fullTitle ?? "score",
                ];
              }}
            />
            {/* Max reference series */}
            <Radar
              dataKey="max"
              fill="hsl(var(--muted))"
              fillOpacity={0.2}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            {/* Actual scores */}
            <Radar
              dataKey="score"
              fill="#3b82f6"
              fillOpacity={0.3}
              stroke="#3b82f6"
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Side legend */}
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {rules.map((r) => (
            <div
              className="flex items-start gap-2 text-[11px]"
              key={`rc-${r.ruleId}`}
            >
              <span
                className={`mt-0.5 shrink-0 font-bold ${r.met ? "text-emerald-500" : "text-red-500"}`}
              >
                {r.met ? "✓" : "✗"}
              </span>
              <div className="min-w-0">
                <span className="font-medium">{r.title}</span>
                {r.score !== undefined && (
                  <span className="text-muted-foreground ml-1">
                    ({r.score}/10)
                  </span>
                )}
                {r.evidence && (
                  <p className="text-muted-foreground truncate leading-snug">
                    {r.evidence}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
