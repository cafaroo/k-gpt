"use client";

import { AlertCircle, CheckCircle2, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { mean } from "@/lib/video/batch/insights";
import type { Batch } from "@/lib/video/batch/types";

type Props = {
  batch: Batch;
};

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </Card>
  );
}

export function BatchHeader({ batch }: Props) {
  const done = batch.videos.filter((v) => v.status === "done" && v.qwen);
  const failed = batch.videos.filter((v) => v.status === "error");
  const avgScore = Math.round(
    mean(done.map((v) => v.qwen?.overall.score ?? 0))
  );
  const winners = done.filter((v) => (v.qwen?.overall.score ?? 0) >= 75).length;
  const perfMatched = batch.videos.filter((v) => v.performance).length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
      <Stat
        hint={`${done.length} analyzed · ${failed.length} failed`}
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label="Videos"
        value={String(batch.videos.length)}
      />
      <Stat
        hint="Qwen overall"
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Avg score"
        value={`${avgScore}`}
      />
      <Stat
        hint={winners === 1 ? "score ≥ 75" : "scores ≥ 75"}
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Winners"
        value={String(winners)}
      />
      <Stat
        hint={
          batch.performanceSource
            ? `CSV: ${batch.performanceSource.matched}/${batch.performanceSource.totalRows} matched`
            : "No CSV loaded"
        }
        icon={<AlertCircle className="h-3.5 w-3.5" />}
        label="Perf data"
        value={`${perfMatched}/${batch.videos.length}`}
      />
    </div>
  );
}
