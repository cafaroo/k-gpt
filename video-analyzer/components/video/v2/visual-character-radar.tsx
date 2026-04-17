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

type Props = {
  payload: {
    visual?: {
      variety?: number;
      dominantFaceRatio?: number;
    };
    onScreenText?: {
      coverageRatio?: number;
    };
    extended?: {
      hookDissection?: { stopPower?: number };
      colloquialityScore?: number;
    };
    pacing?: {
      score?: number;
      complexityAdjustedRhythm?: number;
    };
    hook?: {
      score?: number;
    };
  };
};

function cap10(v: number): number {
  return Math.max(0, Math.min(10, v));
}

export function VisualCharacterRadar({ payload }: Props) {
  const visual = payload.visual ?? {};
  const onScreenText = payload.onScreenText ?? {};
  const ext = payload.extended ?? {};
  const pacing = payload.pacing ?? {};
  const hook = payload.hook ?? {};

  const data = [
    { label: "Variety", value: cap10(visual.variety ?? 0) },
    { label: "Face ratio", value: cap10((visual.dominantFaceRatio ?? 0) * 10) },
    {
      label: "Text coverage",
      value: cap10((onScreenText.coverageRatio ?? 0) * 10),
    },
    {
      label: "Stop power",
      value: cap10(ext.hookDissection?.stopPower ?? 0),
    },
    { label: "Pacing", value: cap10(pacing.score ?? 0) },
    {
      label: "Colloquiality",
      value: cap10(ext.colloquialityScore ?? 0),
    },
    { label: "Hook", value: cap10(hook.score ?? 0) },
    {
      label: "Complexity",
      value: cap10(pacing.complexityAdjustedRhythm ?? 0),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1">
          <CardTitle className="text-sm">Visual character</CardTitle>
          <InfoTooltip metricKey="visualVariety" side="bottom" />
        </div>
      </CardHeader>
      <CardContent>
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
                const label =
                  (ctx?.payload as { label?: string } | undefined)?.label ?? "";
                return [`${Number(value).toFixed(1)}/10`, label];
              }}
            />
            <Radar
              dataKey="value"
              fill="#a855f7"
              fillOpacity={0.3}
              stroke="#a855f7"
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
          {data.map((d) => (
            <div className="flex justify-between text-[11px]" key={d.label}>
              <span className="text-muted-foreground">{d.label}</span>
              <span className="tabular-nums font-medium">
                {d.value.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
