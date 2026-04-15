"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PerformanceData } from "@/lib/video/types";

type Props = {
  value: PerformanceData;
  onChange: (patch: Partial<PerformanceData>) => void;
};

const numberFields: {
  key: keyof PerformanceData;
  label: string;
  hint: string;
  step?: string;
}[] = [
  { key: "views", label: "Views", hint: "e.g. 124000" },
  { key: "likes", label: "Likes", hint: "e.g. 5200" },
  { key: "comments", label: "Comments", hint: "e.g. 180" },
  { key: "shares", label: "Shares", hint: "e.g. 420" },
  {
    key: "completionRate",
    label: "Completion rate",
    hint: "0-1",
    step: "0.01",
  },
  {
    key: "avgWatchTime",
    label: "Avg watch time (s)",
    hint: "e.g. 18.5",
    step: "0.1",
  },
  { key: "clickThroughRate", label: "CTR", hint: "0-1", step: "0.0001" },
  { key: "costPerClick", label: "CPC ($)", hint: "e.g. 0.75", step: "0.01" },
  { key: "costPerMille", label: "CPM ($)", hint: "e.g. 8.2", step: "0.01" },
];

export function MetricsInput({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {numberFields.map((f) => (
        <div className="flex flex-col gap-1" key={f.key}>
          <Label className="text-xs" htmlFor={f.key}>
            {f.label}
          </Label>
          <Input
            id={f.key}
            inputMode="decimal"
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                [f.key]: v === "" ? undefined : Number(v),
              } as Partial<PerformanceData>);
            }}
            placeholder={f.hint}
            step={f.step}
            type="number"
            value={(value[f.key] as number | undefined) ?? ""}
          />
        </div>
      ))}
      <div className="col-span-2 flex flex-col gap-1">
        <Label className="text-xs" htmlFor="platform">
          Platform
        </Label>
        <select
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
          id="platform"
          onChange={(e) =>
            onChange({
              platform:
                (e.target.value as PerformanceData["platform"]) || undefined,
            })
          }
          value={value.platform ?? ""}
        >
          <option value="">—</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="youtube_shorts">YouTube Shorts</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>
    </div>
  );
}
