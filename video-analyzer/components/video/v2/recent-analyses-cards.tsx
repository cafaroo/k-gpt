"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

// ── Types ──────────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  filename: string | null;
  thumbnailUrl: string | null;
  overallScore: number | null;
  ecr: string | null;
  nawp: string | null;
  colloquialityScore: string | null;
  authenticityBand: "low" | "moderate" | "high" | null;
  niche?: string | null;
  platformBestFit?: string | null;
  createdAt: string;
  durationSec?: string | number | null;
};

type Props = {
  rows: Row[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function authenticityColors(band: "low" | "moderate" | "high" | null): string {
  if (band === "high") return "bg-emerald-500/15 text-emerald-600";
  if (band === "moderate") return "bg-amber-500/15 text-amber-700";
  if (band === "low") return "bg-red-500/15 text-red-600";
  return "bg-muted text-muted-foreground";
}

function ecrColor(ecr: number | null): string {
  if (ecr == null) return "text-muted-foreground";
  if (ecr >= 0.7) return "text-emerald-500";
  if (ecr >= 0.4) return "text-amber-500";
  return "text-red-500";
}

function colloqColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 8) return "text-emerald-500";
  if (score >= 5) return "text-amber-500";
  return "text-red-500";
}

// Gradient fallback colors per index
const FALLBACK_GRADIENTS = [
  "from-blue-900/60 to-indigo-900/80",
  "from-emerald-900/60 to-teal-900/80",
  "from-amber-900/60 to-orange-900/80",
  "from-purple-900/60 to-violet-900/80",
  "from-rose-900/60 to-pink-900/80",
  "from-slate-800/60 to-slate-900/80",
];

// ── PosterCard ─────────────────────────────────────────────────────────────────

function PosterCard({ row, idx }: { row: Row; idx: number }) {
  const ecr = row.ecr ? Number(row.ecr) : null;
  const colloq = row.colloquialityScore ? Number(row.colloquialityScore) : null;
  const gradient = FALLBACK_GRADIENTS[idx % FALLBACK_GRADIENTS.length];

  return (
    <Link href={`/analyze/v2/video/${row.id}`} className="group block">
      <Card className="overflow-hidden hover:border-primary/50 transition-colors">
        {/* Thumbnail / poster */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          {row.thumbnailUrl ? (
            <img
              src={row.thumbnailUrl}
              alt={row.filename ?? "Video thumbnail"}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}
            >
              <span className="text-2xl font-bold text-white/20 select-none truncate px-4 text-center max-w-full">
                {row.filename?.replace(/\.[^.]+$/, "") ?? "—"}
              </span>
            </div>
          )}

          {/* Overall score pill */}
          {row.overallScore != null && (
            <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
              {row.overallScore}/100
            </div>
          )}

          {/* "View →" overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-black">
              View →
            </span>
          </div>
        </div>

        <CardContent className="p-3 space-y-2">
          {/* Filename */}
          <div className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
            {row.filename ?? "Untitled"}
          </div>

          {/* ECR + Colloq numbers */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                ECR
              </span>
              <span
                className={`text-lg font-bold tabular-nums leading-tight ${ecrColor(ecr)}`}
              >
                {ecr != null ? ecr.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                Colloq
              </span>
              <span
                className={`text-lg font-bold tabular-nums leading-tight ${colloqColor(colloq)}`}
              >
                {colloq != null ? colloq.toFixed(1) : "—"}
              </span>
            </div>
            {/* Authenticity badge */}
            {row.authenticityBand && (
              <div className="ml-auto">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${authenticityColors(row.authenticityBand)}`}
                >
                  {row.authenticityBand}
                </span>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="text-[10px] text-muted-foreground">
            {new Date(row.createdAt).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function RecentAnalysesCards({ rows }: Props) {
  const recent = rows.slice(0, 6);

  if (recent.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recent Analyses
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recent.map((row, idx) => (
          <PosterCard key={row.id} row={row} idx={idx} />
        ))}
      </div>
    </div>
  );
}
