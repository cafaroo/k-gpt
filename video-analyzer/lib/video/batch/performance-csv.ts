import Papa from "papaparse";
import type { PerformanceData } from "../types";
import type {
  PerformanceColumnMapping,
  PerformanceRow,
  VideoJob,
} from "./types";

export type ParsedCsv = {
  filename: string;
  columns: string[];
  rows: PerformanceRow[];
};

export function parseCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<PerformanceRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        resolve({
          filename: file.name,
          columns: result.meta.fields ?? [],
          rows: (result.data as PerformanceRow[]) ?? [],
        });
      },
      error: (err) => reject(err),
    });
  });
}

export function autoGuessMapping(columns: string[]): PerformanceColumnMapping {
  const find = (candidates: RegExp[]): string | undefined =>
    columns.find((c) => candidates.some((r) => r.test(c)));

  return {
    filename:
      find([
        /^file\s*name$/i,
        /^filename$/i,
        /^name$/i,
        /^video$/i,
        /^file$/i,
      ]) ??
      columns[0] ??
      "",
    views: find([/views?/i, /impressions/i]),
    likes: find([/likes?/i, /reactions/i]),
    comments: find([/comments?/i, /replies?/i]),
    shares: find([/shares?/i, /sends?/i]),
    completionRate: find([/completion\s*rate/i, /completed/i, /watch\s*rate/i]),
    avgWatchTime: find([/avg\s*watch/i, /average\s*watch/i, /watch\s*time/i]),
    clickThroughRate: find([/ctr/i, /click\s*through/i]),
    costPerClick: find([/cpc/i, /cost\s*per\s*click/i]),
    costPerMille: find([/cpm/i, /cost\s*per\s*mille/i]),
    platform: find([/platform/i, /source/i]),
  };
}

/**
 * Normalize filename for fuzzy matching. Strips extension, lowercases,
 * removes non-alphanumerics, drops trailing version suffixes.
 */
export function normalizeFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[\s_\-()]+/g, "")
    .replace(/compressed|final|v\d+|copy\d*/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function matchRowsToVideos(
  rows: PerformanceRow[],
  mapping: PerformanceColumnMapping,
  videos: VideoJob[]
): {
  matches: Map<string, PerformanceRow>; // videoId → row
  unmatchedRows: PerformanceRow[];
  unmatchedVideos: VideoJob[];
} {
  const matches = new Map<string, PerformanceRow>();
  const usedRows = new Set<number>();

  const normalized = videos.map((v) => ({
    id: v.id,
    norm: normalizeFilename(v.filename),
  }));

  rows.forEach((row, idx) => {
    const raw = row[mapping.filename];
    if (raw === null || raw === undefined) {
      return;
    }
    const rowNorm = normalizeFilename(String(raw));
    if (!rowNorm) {
      return;
    }
    const hit = normalized.find((n) => n.norm === rowNorm);
    if (hit && !matches.has(hit.id)) {
      matches.set(hit.id, row);
      usedRows.add(idx);
    }
  });

  // Substring fallback for partial matches (e.g. CSV has "MC_31", video has "MC_31_compressed")
  rows.forEach((row, idx) => {
    if (usedRows.has(idx)) {
      return;
    }
    const raw = row[mapping.filename];
    if (raw === null || raw === undefined) {
      return;
    }
    const rowNorm = normalizeFilename(String(raw));
    if (!rowNorm) {
      return;
    }
    const hit = normalized.find(
      (n) =>
        !matches.has(n.id) &&
        (n.norm.includes(rowNorm) || rowNorm.includes(n.norm))
    );
    if (hit) {
      matches.set(hit.id, row);
      usedRows.add(idx);
    }
  });

  const unmatchedRows = rows.filter((_, idx) => !usedRows.has(idx));
  const unmatchedVideos = videos.filter((v) => !matches.has(v.id));

  return { matches, unmatchedRows, unmatchedVideos };
}

export function rowToPerformance(
  row: PerformanceRow,
  mapping: PerformanceColumnMapping
): PerformanceData {
  const num = (key?: string): number | undefined => {
    if (!key) {
      return;
    }
    const v = row[key];
    if (v === null || v === undefined || v === "") {
      return;
    }
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const platformValue = mapping.platform
    ? String(row[mapping.platform] ?? "").toLowerCase()
    : "";
  const platform: PerformanceData["platform"] =
    platformValue === "tiktok" ||
    platformValue === "instagram" ||
    platformValue === "youtube_shorts" ||
    platformValue === "facebook"
      ? platformValue
      : undefined;

  return {
    views: num(mapping.views),
    likes: num(mapping.likes),
    comments: num(mapping.comments),
    shares: num(mapping.shares),
    completionRate: num(mapping.completionRate),
    avgWatchTime: num(mapping.avgWatchTime),
    clickThroughRate: num(mapping.clickThroughRate),
    costPerClick: num(mapping.costPerClick),
    costPerMille: num(mapping.costPerMille),
    platform,
  };
}
