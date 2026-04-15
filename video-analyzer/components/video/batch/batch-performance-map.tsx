"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type {
  PerformanceColumnMapping,
  PerformanceRow,
} from "@/lib/video/batch/types";

type Props = {
  filename: string;
  columns: string[];
  rows: PerformanceRow[];
  mapping: PerformanceColumnMapping;
  onUpdate: (patch: Partial<PerformanceColumnMapping>) => void;
  onApply: () => void;
  onCancel: () => void;
};

const FIELDS: {
  key: keyof PerformanceColumnMapping;
  label: string;
  required?: boolean;
}[] = [
  { key: "filename", label: "Filename", required: true },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "completionRate", label: "Completion rate (0-1)" },
  { key: "avgWatchTime", label: "Avg watch time (s)" },
  { key: "clickThroughRate", label: "CTR (0-1)" },
  { key: "costPerClick", label: "CPC" },
  { key: "costPerMille", label: "CPM" },
  { key: "platform", label: "Platform" },
];

export function BatchPerformanceMap({
  filename,
  columns,
  rows,
  mapping,
  onUpdate,
  onApply,
  onCancel,
}: Props) {
  const ready = Boolean(mapping.filename);

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">
          Map columns from <span className="font-mono text-sm">{filename}</span>
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          {rows.length} rows · pick which CSV column maps to each metric. Only
          filename is required — rest is optional.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div className="flex flex-col gap-1" key={f.key}>
              <Label className="text-xs" htmlFor={f.key}>
                {f.label}
                {f.required && <span className="text-destructive">*</span>}
              </Label>
              <select
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                id={f.key}
                onChange={(e) =>
                  onUpdate({
                    [f.key]: e.target.value || undefined,
                  } as Partial<PerformanceColumnMapping>)
                }
                value={mapping[f.key] ?? ""}
              >
                <option value="">— none —</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {rows.length > 0 && (
          <div>
            <Label className="mb-1 text-xs">Preview (first 3 rows)</Label>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.slice(0, 6).map((c) => (
                      <th className="px-2 py-1 text-left font-medium" key={c}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((r) => {
                    const rowKey = columns
                      .slice(0, 4)
                      .map((c) => String(r[c] ?? ""))
                      .join("|");
                    return (
                      <tr className="border-t" key={rowKey}>
                        {columns.slice(0, 6).map((c) => (
                          <td className="px-2 py-1" key={c}>
                            {String(r[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onCancel} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={!ready} onClick={onApply} size="sm">
            <Check className="mr-1 h-4 w-4" />
            Apply mapping
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
