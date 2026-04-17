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
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type PlatformFit = {
  tiktok: { score: number; reasoning: string };
  reels: { score: number; reasoning: string };
  youtubeShorts: { score: number; reasoning: string };
  bestFit: "tiktok" | "reels" | "youtube-shorts" | "all-equal";
  notes?: string;
};

type Props = {
  platformFit?: PlatformFit;
};

const BEST_FIT_LABELS: Record<PlatformFit["bestFit"], string> = {
  tiktok: "TikTok",
  reels: "Reels",
  "youtube-shorts": "YouTube Shorts",
  "all-equal": "All equal",
};

export function PlatformFitRadar({ platformFit }: Props) {
  if (!platformFit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Platform fit</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          No platform fit data.
        </CardContent>
      </Card>
    );
  }

  const bestFitLabel = BEST_FIT_LABELS[platformFit.bestFit];

  const data = [
    {
      label: "TikTok",
      value: platformFit.tiktok.score,
      reasoning: platformFit.tiktok.reasoning,
      best: platformFit.bestFit === "tiktok",
    },
    {
      label: "Reels",
      value: platformFit.reels.score,
      reasoning: platformFit.reels.reasoning,
      best: platformFit.bestFit === "reels",
    },
    {
      label: "YT Shorts",
      value: platformFit.youtubeShorts.score,
      reasoning: platformFit.youtubeShorts.reasoning,
      best: platformFit.bestFit === "youtube-shorts",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <CardTitle className="text-sm">Platform fit</CardTitle>
            <InfoTooltip metricKey="platformFit" side="bottom" />
          </div>
          {platformFit.bestFit !== "all-equal" && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              Best: {bestFitLabel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer height={220} width="100%">
          <RadarChart
            data={data}
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
          >
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="label"
              tick={({ x, y, payload }) => {
                const item = data.find((d) => d.label === payload.value);
                return (
                  <text
                    dominantBaseline="central"
                    fill={
                      item?.best
                        ? "hsl(var(--primary))"
                        : "hsl(var(--muted-foreground))"
                    }
                    fontSize={10}
                    fontWeight={item?.best ? 700 : 400}
                    textAnchor="middle"
                    x={x}
                    y={y}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis
              angle={90}
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
                const item = ctx?.payload as
                  | { reasoning?: string; label?: string }
                  | undefined;
                return [
                  `${Number(value).toFixed(1)}/10${item?.reasoning ? ` — ${item.reasoning}` : ""}`,
                  item?.label ?? "",
                ];
              }}
            />
            <Radar
              dataKey="value"
              fill="#f59e0b"
              fillOpacity={0.3}
              stroke="#f59e0b"
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        <div className="space-y-1.5">
          {data.map((d) => (
            <div
              className={`rounded-md border p-2 ${d.best ? "border-primary" : ""}`}
              key={d.label}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {d.label}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${d.value >= 7.5 ? "text-emerald-500" : d.value >= 5 ? "text-amber-500" : "text-red-500"}`}
                >
                  {d.value.toFixed(1)}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-snug">
                {d.reasoning}
              </p>
            </div>
          ))}
        </div>

        {platformFit.notes && (
          <p className="text-muted-foreground text-xs italic">
            {platformFit.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
