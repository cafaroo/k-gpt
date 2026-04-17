"use client";
import Link from "next/link";
import type { QueueItem } from "@/hooks/use-v2-upload-queue";

const STATE_LABEL: Record<QueueItem["state"], string> = {
  queued: "queued",
  uploading: "uploading",
  analyzing: "analyzing",
  done: "done",
  error: "error",
};

export function QueueList({ items }: { items: QueueItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="mt-8 rounded-lg border divide-y">
      {items.map((item) => (
        <div
          className="flex items-center gap-4 px-4 py-3 text-sm"
          key={item.id}
        >
          <div className="flex-1 truncate font-medium">{item.file.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {(item.file.size / 1024 / 1024).toFixed(1)} MB
          </div>
          <div
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              item.state === "done"
                ? "bg-emerald-500/10 text-emerald-500"
                : item.state === "error"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-muted"
            }`}
          >
            {STATE_LABEL[item.state]}
          </div>
          {item.state === "done" && item.analysisId && (
            <Link
              className="text-xs text-primary hover:underline"
              href={`/analyze/v2/video/${item.analysisId}`}
            >
              View →
            </Link>
          )}
          {item.state === "error" && (
            <div className="text-xs text-red-500">{item.errorMessage}</div>
          )}
        </div>
      ))}
    </div>
  );
}
