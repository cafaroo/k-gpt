"use client";

import { AlertCircle, Check, Clock, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { VideoJob } from "@/lib/video/batch/types";

type Props = {
  videos: VideoJob[];
  overallProgress: number;
  doneCount: number;
  errorCount: number;
};

function StatusIcon({ status }: { status: VideoJob["status"] }) {
  if (status === "done") {
    return <Check className="h-4 w-4 text-emerald-500" />;
  }
  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
  if (status === "queued") {
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
}

export function BatchQueueProgress({
  videos,
  overallProgress,
  doneCount,
  errorCount,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Card className="p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">
            Analyzing {videos.length} video{videos.length === 1 ? "" : "s"}…
          </h3>
          <span className="text-muted-foreground text-xs">
            {doneCount}/{videos.length} done
            {errorCount > 0 && ` · ${errorCount} failed`}
          </span>
        </div>
        <Progress value={overallProgress * 100} />
      </Card>

      <Card className="divide-y">
        {videos.map((v) => (
          <div className="flex items-center gap-3 px-4 py-3 text-sm" key={v.id}>
            <StatusIcon status={v.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{v.filename}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {v.status === "done"
                    ? `${v.qwen?.overall.score ?? "—"}/100`
                    : v.step}
                </span>
              </div>
              <div className="mt-1">
                <Progress
                  className="h-1"
                  value={v.status === "done" ? 100 : v.progress * 100}
                />
              </div>
              {v.error && (
                <p className="text-destructive mt-1 text-xs">{v.error}</p>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
