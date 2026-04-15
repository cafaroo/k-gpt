/**
 * Batch data shapes.
 *
 * These are designed to mirror a future Neo4j graph model:
 *   (:Batch)-[:HAS_VIDEO]->(:Video)-[:EXHIBITS_HOOK]->(:HookStyle)
 *   (:Video)-[:HAS_CTA]->(:CTA)
 *   (:Batch)-[:PRODUCED]->(:Insight)
 * For now everything lives in React state.
 */

import type { AudioAnalysis } from "../audio-schema";
import type { QwenAnalysis } from "../qwen-schema";
import type { PerformanceData, VideoExtraction } from "../types";

export type JobStatus =
  | "queued"
  | "extracting"
  | "analyzing"
  | "done"
  | "error";

export type VideoJob = {
  id: string;
  filename: string;
  file: File;
  status: JobStatus;
  progress: number; // 0..1
  step: string;
  error: string | null;
  extraction: VideoExtraction | null;
  qwen: QwenAnalysis | null;
  audio: AudioAnalysis | null;
  performance: PerformanceData | null;
  thumbnailDataUrl: string | null;
  startedAt: number | null;
  finishedAt: number | null;
};

export type PerformanceSource = {
  filename: string;
  totalRows: number;
  matched: number;
  unmatched: number;
  columnMapping: PerformanceColumnMapping;
};

export type PerformanceColumnMapping = {
  filename: string; // column name in CSV that holds the filename
  views?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  completionRate?: string;
  avgWatchTime?: string;
  clickThroughRate?: string;
  costPerClick?: string;
  costPerMille?: string;
  platform?: string;
};

export type PerformanceRow = Record<string, string | number | null>;

export type Batch = {
  id: string;
  createdAt: number;
  videos: VideoJob[];
  performanceSource: PerformanceSource | null;
  performanceRows: PerformanceRow[]; // raw rows kept for re-matching
};

export type BatchInsightKind =
  | "hook-style-performance"
  | "cta-timing"
  | "pacing-correlation"
  | "niche-playbook"
  | "rule-compliance"
  | "text-overlay"
  | "audio-mood"
  | "structural-distribution";

export type BatchInsight = {
  id: string;
  kind: BatchInsightKind;
  title: string;
  finding: string;
  metric: string;
  delta: number; // positive = winner multiplier
  confidence: number; // 0..1
  videoIds: string[];
};
