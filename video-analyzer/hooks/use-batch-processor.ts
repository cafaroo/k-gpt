"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  autoGuessMapping,
  matchRowsToVideos,
  parseCsv,
  rowToPerformance,
} from "@/lib/video/batch/performance-csv";
import { runBatch } from "@/lib/video/batch/queue";
import type {
  Batch,
  PerformanceColumnMapping,
  PerformanceRow,
  PerformanceSource,
  VideoJob,
} from "@/lib/video/batch/types";

type BatchPhase =
  | "idle"
  | "csv-parsed"
  | "configuring"
  | "running"
  | "done"
  | "error";

const CONCURRENCY = 3;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBatch(): Batch {
  // id + createdAt set after mount to stay SSR/prerender-safe
  return {
    id: "",
    createdAt: 0,
    videos: [],
    performanceSource: null,
    performanceRows: [],
  };
}

export function useBatchProcessor() {
  const [phase, setPhase] = useState<BatchPhase>("idle");
  const [batch, setBatch] = useState<Batch>(emptyBatch);

  useEffect(() => {
    if (batch.id === "") {
      setBatch((prev) => ({
        ...prev,
        id: uid("batch"),
        createdAt: Date.now(),
      }));
    }
  }, [batch.id]);

  const [pendingCsv, setPendingCsv] = useState<{
    filename: string;
    columns: string[];
    rows: PerformanceRow[];
    mapping: PerformanceColumnMapping;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const batchRef = useRef(batch);
  batchRef.current = batch;

  const addVideos = useCallback((files: File[]) => {
    setBatch((prev) => {
      const newJobs: VideoJob[] = files.map((f) => ({
        id: uid("vid"),
        filename: f.name,
        file: f,
        status: "queued",
        progress: 0,
        step: "Queued",
        error: null,
        extraction: null,
        qwen: null,
        audio: null,
        performance: null,
        thumbnailDataUrl: null,
        startedAt: null,
        finishedAt: null,
      }));
      return { ...prev, videos: [...prev.videos, ...newJobs] };
    });
  }, []);

  const removeVideo = useCallback((id: string) => {
    setBatch((prev) => ({
      ...prev,
      videos: prev.videos.filter((v) => v.id !== id),
    }));
  }, []);

  const attachCsv = useCallback(async (file: File) => {
    try {
      setError(null);
      const parsed = await parseCsv(file);
      setPendingCsv({
        filename: parsed.filename,
        columns: parsed.columns,
        rows: parsed.rows,
        mapping: autoGuessMapping(parsed.columns),
      });
      setPhase("csv-parsed");
    } catch (err) {
      setError(
        err instanceof Error
          ? `CSV parse failed: ${err.message}`
          : "CSV parse failed"
      );
    }
  }, []);

  const updateCsvMapping = useCallback(
    (patch: Partial<PerformanceColumnMapping>) => {
      setPendingCsv((prev) =>
        prev ? { ...prev, mapping: { ...prev.mapping, ...patch } } : prev
      );
    },
    []
  );

  const applyCsv = useCallback(() => {
    const pending = pendingCsv;
    if (!pending) {
      return;
    }

    const { matches, unmatchedRows } = matchRowsToVideos(
      pending.rows,
      pending.mapping,
      batchRef.current.videos
    );

    const source: PerformanceSource = {
      filename: pending.filename,
      totalRows: pending.rows.length,
      matched: matches.size,
      unmatched: unmatchedRows.length,
      columnMapping: pending.mapping,
    };

    setBatch((prev) => ({
      ...prev,
      performanceSource: source,
      performanceRows: pending.rows,
      videos: prev.videos.map((v) => {
        const row = matches.get(v.id);
        if (!row) {
          return v;
        }
        return { ...v, performance: rowToPerformance(row, pending.mapping) };
      }),
    }));

    setPendingCsv(null);
  }, [pendingCsv]);

  const manualAssignRow = useCallback((videoId: string, rowIndex: number) => {
    const rows = batchRef.current.performanceRows;
    const row = rows[rowIndex];
    const mapping = batchRef.current.performanceSource?.columnMapping;
    if (!(row && mapping)) {
      return;
    }
    setBatch((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.id === videoId
          ? { ...v, performance: rowToPerformance(row, mapping) }
          : v
      ),
    }));
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<VideoJob>) => {
    setBatch((prev) => ({
      ...prev,
      videos: prev.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }, []);

  const start = useCallback(async () => {
    if (batchRef.current.videos.length === 0) {
      setError("Add at least one video before starting.");
      return;
    }
    try {
      setError(null);
      setPhase("running");
      await runBatch(batchRef.current.videos, CONCURRENCY, updateJob);
      setPhase("done");
    } catch (err) {
      console.error("[batch]", err);
      setError(err instanceof Error ? err.message : "Batch failed");
      setPhase("error");
    }
  }, [updateJob]);

  const reset = useCallback(() => {
    setBatch({
      id: uid("batch"),
      createdAt: Date.now(),
      videos: [],
      performanceSource: null,
      performanceRows: [],
    });
    setPendingCsv(null);
    setError(null);
    setPhase("idle");
  }, []);

  const progress = useMemo(() => {
    const jobs = batch.videos;
    if (jobs.length === 0) {
      return 0;
    }
    const total = jobs.reduce((acc, j) => {
      if (j.status === "done") {
        return acc + 1;
      }
      if (j.status === "error") {
        return acc + 1;
      }
      return acc + j.progress;
    }, 0);
    return total / jobs.length;
  }, [batch.videos]);

  const doneCount = batch.videos.filter((v) => v.status === "done").length;
  const errorCount = batch.videos.filter((v) => v.status === "error").length;

  return {
    phase,
    batch,
    pendingCsv,
    error,
    progress,
    doneCount,
    errorCount,
    addVideos,
    removeVideo,
    attachCsv,
    updateCsvMapping,
    applyCsv,
    manualAssignRow,
    start,
    reset,
  };
}
