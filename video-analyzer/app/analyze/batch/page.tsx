"use client";

import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BatchDistribution } from "@/components/video/batch/batch-distribution";
import { BatchHeader } from "@/components/video/batch/batch-header";
import { BatchLeaderboard } from "@/components/video/batch/batch-leaderboard";
import { BatchPatternFinder } from "@/components/video/batch/batch-pattern-finder";
import { BatchPerformanceMap } from "@/components/video/batch/batch-performance-map";
import { BatchQueueProgress } from "@/components/video/batch/batch-queue-progress";
import { BatchUpload } from "@/components/video/batch/batch-upload";
import { BatchWinnersCard } from "@/components/video/batch/batch-winners-card";
import { QwenDashboard } from "@/components/video/qwen-dashboard";
import { useBatchProcessor } from "@/hooks/use-batch-processor";
import { exportBatch } from "@/lib/video/exporter";

export default function BatchPage() {
  const processor = useBatchProcessor();
  const [drillId, setDrillId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const drill = drillId
    ? processor.batch.videos.find((v) => v.id === drillId)
    : null;

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportBatch(processor.batch);
      toast.success("Batch exported");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // ─── DRILL-DOWN: individual video ─────────────────────────────────────
  if (drill?.extraction) {
    return (
      <div>
        <div className="sticky top-14 z-10 bg-background/80 backdrop-blur border-b px-4 py-2">
          <Button onClick={() => setDrillId(null)} size="sm" variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to batch
          </Button>
        </div>
        <QwenDashboard
          analysis={drill.qwen}
          analysisError={drill.error}
          audioAnalysis={drill.audio}
          extraction={drill.extraction}
          file={drill.file}
          onReset={() => setDrillId(null)}
        />
      </div>
    );
  }

  // ─── PHASE: CSV column mapping ────────────────────────────────────────
  if (processor.phase === "csv-parsed" && processor.pendingCsv) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <BatchPerformanceMap
          columns={processor.pendingCsv.columns}
          filename={processor.pendingCsv.filename}
          mapping={processor.pendingCsv.mapping}
          onApply={processor.applyCsv}
          onCancel={processor.reset}
          onUpdate={processor.updateCsvMapping}
          rows={processor.pendingCsv.rows}
        />
      </div>
    );
  }

  // ─── PHASE: running / partial done — show progress ─────────────────────
  if (processor.phase === "running") {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <h1 className="text-center text-2xl font-bold tracking-tight">
          Analyzing your batch…
        </h1>
        <BatchQueueProgress
          doneCount={processor.doneCount}
          errorCount={processor.errorCount}
          overallProgress={processor.progress}
          videos={processor.batch.videos}
        />
      </div>
    );
  }

  // ─── PHASE: done — full dashboard ─────────────────────────────────────
  if (processor.phase === "done" || processor.doneCount > 0) {
    const hasPerformanceData = processor.batch.videos.some(
      (v) => v.performance !== null
    );
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Batch results</h1>
            <p className="text-muted-foreground text-sm">
              {processor.batch.videos.length} videos · created{" "}
              {new Date(processor.batch.createdAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={exporting}
              onClick={handleExport}
              size="sm"
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Export zip
            </Button>
            <Button onClick={processor.reset} size="sm" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              New batch
            </Button>
          </div>
        </div>

        <BatchHeader batch={processor.batch} />

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <BatchPatternFinder
            hasPerformanceData={hasPerformanceData}
            videos={processor.batch.videos}
          />
          <div className="space-y-4">
            <BatchDistribution videos={processor.batch.videos} />
            <BatchWinnersCard
              onPick={setDrillId}
              videos={processor.batch.videos}
            />
          </div>
        </div>

        <BatchLeaderboard
          hasPerformanceData={hasPerformanceData}
          onPick={setDrillId}
          videos={processor.batch.videos}
        />
      </div>
    );
  }

  // ─── PHASE: idle — upload UI ───────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10">
      <div className="flex justify-end">
        <Link
          className="text-muted-foreground hover:text-foreground text-xs"
          href="/analyze"
        >
          ← Analyze a single video
        </Link>
      </div>
      <BatchUpload
        batch={processor.batch}
        error={processor.error}
        hasCsv={processor.batch.performanceSource !== null}
        onAddVideos={processor.addVideos}
        onAttachCsv={processor.attachCsv}
        onRemoveVideo={processor.removeVideo}
        onStart={processor.start}
      />
    </div>
  );
}
