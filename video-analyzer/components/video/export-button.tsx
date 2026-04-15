"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AudioAnalysis } from "@/lib/video/audio-schema";
import { exportAnalysis } from "@/lib/video/exporter";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";
import type {
  ExportChartRefs,
  PerformanceData,
  VideoExtraction,
} from "@/lib/video/types";

type Props = {
  analysis: {
    extraction: VideoExtraction;
    performance?: PerformanceData;
    qwenAnalysis?: QwenAnalysis | null;
    audioAnalysis?: AudioAnalysis | null;
  };
  chartRefs: ExportChartRefs;
};

export function ExportButton({ analysis, chartRefs }: Props) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    try {
      setBusy(true);
      await exportAnalysis(analysis, chartRefs);
      toast.success("Analysis exported");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button disabled={busy} onClick={handle} size="sm" variant="outline">
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export
    </Button>
  );
}
