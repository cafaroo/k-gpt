"use client";

import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/video/v2/info-tooltip";

type PredictedMetrics = {
  completionRate: string;
  engagementRate: string;
  holdTo3sScore: number;
  saveLikelihood: number;
  commentLikelihood: number;
  shareLikelihood: number;
  ecr?: number;
  nawp?: number;
  ecrRationale?: string;
  nawpRationale?: string;
  rationale?: string;
};

type Props = {
  analysis: {
    overall: { score: number; tagline: string; summary: string };
    predictedMetrics: PredictedMetrics;
    extended?: {
      colloquialityScore?: number;
      authenticityBand?: "low" | "moderate" | "high";
      brandHeritageSalience?: "absent" | "moderate" | "high";
      hookDissection?: { stopPower?: number };
    };
    researchMeta?: {
      ecr?: { value: number; rationale: string };
      nawp?: { value: number; rationale: string };
    };
  };
};

function scoreColor(score: number): string {
  if (score >= 80) {
    return "text-emerald-500";
  }
  if (score >= 60) {
    return "text-amber-500";
  }
  return "text-red-500";
}

function perfLevelColor(level: string): string {
  if (level === "high") {
    return "bg-emerald-500/15 text-emerald-600";
  }
  if (level === "medium") {
    return "bg-amber-500/15 text-amber-600";
  }
  return "bg-red-500/15 text-red-600";
}

function MiniBadge({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border px-3 py-2 min-w-[72px]">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
      {unit && <span className="text-[9px] text-muted-foreground">{unit}</span>}
    </div>
  );
}

function PredBadge({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${perfLevelColor(value)}`}
    >
      <span className="text-muted-foreground mr-1 text-[10px]">{label}</span>
      {value}
    </div>
  );
}

function LikelihoodBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  let barColor = "bg-emerald-500";
  if (value < 4) {
    barColor = "bg-red-500";
  } else if (value < 6.5) {
    barColor = "bg-amber-500";
  }
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value.toFixed(1)}/10</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function OverallScorecard({ analysis }: Props) {
  const { overall, predictedMetrics, extended, researchMeta } = analysis;
  const ecr = researchMeta?.ecr?.value ?? predictedMetrics.ecr ?? 0;
  const nawp = researchMeta?.nawp?.value ?? predictedMetrics.nawp ?? 0;
  const stopPower = extended?.hookDissection?.stopPower ?? 0;
  const colloq = extended?.colloquialityScore ?? 0;
  const authBand = extended?.authenticityBand;
  const brandHeritage = extended?.brandHeritageSalience;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`text-5xl font-bold tabular-nums ${scoreColor(overall.score)}`}
            >
              {overall.score}
            </div>
            <div>
              <CardTitle className="text-base">{overall.tagline}</CardTitle>
              <div className="text-muted-foreground mt-0.5 text-xs">
                Overall score / 100
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {authBand && (
              <span
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                  authBand === "low"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : authBand === "high"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {authBand === "moderate" && (
                  <AlertTriangle className="h-3 w-3" />
                )}
                Authenticity: {authBand}
                <InfoTooltip metricKey="authenticityBand" side="bottom" />
              </span>
            )}
            {brandHeritage && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Brand heritage: {brandHeritage}
                <InfoTooltip metricKey="brandHeritageSalience" side="bottom" />
              </span>
            )}
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {overall.summary}
        </p>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        {/* Research stat row */}
        <div>
          <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Research metrics
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col items-center rounded-lg border px-3 py-2 min-w-[72px]">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                ECR
                <InfoTooltip metricKey="ecr" side="top" />
              </span>
              <span className="text-base font-semibold tabular-nums">{ecr.toFixed(2)}</span>
              <span className="text-[9px] text-muted-foreground">0-1</span>
            </div>
            <div className="flex flex-col items-center rounded-lg border px-3 py-2 min-w-[72px]">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                NAWP
                <InfoTooltip metricKey="nawp" side="top" />
              </span>
              <span className="text-base font-semibold tabular-nums">{nawp.toFixed(2)}</span>
              <span className="text-[9px] text-muted-foreground">0-1</span>
            </div>
            <div className="flex flex-col items-center rounded-lg border px-3 py-2 min-w-[72px]">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Stop power
                <InfoTooltip metricKey="stopPower" side="top" />
              </span>
              <span className="text-base font-semibold tabular-nums">{stopPower.toFixed(1)}</span>
              <span className="text-[9px] text-muted-foreground">0-10</span>
            </div>
            <div className="flex flex-col items-center rounded-lg border px-3 py-2 min-w-[72px]">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Colloquiality
                <InfoTooltip metricKey="colloquialityScore" side="top" />
              </span>
              <span className="text-base font-semibold tabular-nums">{colloq.toFixed(1)}</span>
              <span className="text-[9px] text-muted-foreground">0-10</span>
            </div>
          </div>
        </div>

        {/* Predicted metrics */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Predicted performance
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <PredBadge
              label="Completion"
              value={predictedMetrics.completionRate}
            />
            <PredBadge
              label="Engagement"
              value={predictedMetrics.engagementRate}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Hold to 3s
                  <InfoTooltip metricKey="holdTo3sScore" side="top" />
                </span>
                <span className="tabular-nums font-medium">{predictedMetrics.holdTo3sScore.toFixed(1)}/10</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${predictedMetrics.holdTo3sScore < 4 ? "bg-red-500" : predictedMetrics.holdTo3sScore < 6.5 ? "bg-amber-500" : "bg-emerald-500"} transition-all`}
                  style={{ width: `${Math.max(0, Math.min(10, predictedMetrics.holdTo3sScore)) * 10}%` }}
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Save
                  <InfoTooltip metricKey="saveLikelihood" side="top" />
                </span>
                <span className="tabular-nums font-medium">{predictedMetrics.saveLikelihood.toFixed(1)}/10</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${predictedMetrics.saveLikelihood < 4 ? "bg-red-500" : predictedMetrics.saveLikelihood < 6.5 ? "bg-amber-500" : "bg-emerald-500"} transition-all`}
                  style={{ width: `${Math.max(0, Math.min(10, predictedMetrics.saveLikelihood)) * 10}%` }}
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Comment
                  <InfoTooltip metricKey="commentLikelihood" side="top" />
                </span>
                <span className="tabular-nums font-medium">{predictedMetrics.commentLikelihood.toFixed(1)}/10</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${predictedMetrics.commentLikelihood < 4 ? "bg-red-500" : predictedMetrics.commentLikelihood < 6.5 ? "bg-amber-500" : "bg-emerald-500"} transition-all`}
                  style={{ width: `${Math.max(0, Math.min(10, predictedMetrics.commentLikelihood)) * 10}%` }}
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Share
                  <InfoTooltip metricKey="shareLikelihood" side="top" />
                </span>
                <span className="tabular-nums font-medium">{predictedMetrics.shareLikelihood.toFixed(1)}/10</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${predictedMetrics.shareLikelihood < 4 ? "bg-red-500" : predictedMetrics.shareLikelihood < 6.5 ? "bg-amber-500" : "bg-emerald-500"} transition-all`}
                  style={{ width: `${Math.max(0, Math.min(10, predictedMetrics.shareLikelihood)) * 10}%` }}
                />
              </div>
            </div>
          </div>
          {predictedMetrics.rationale && (
            <p className="text-muted-foreground mt-2 text-xs italic leading-relaxed">
              {predictedMetrics.rationale}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
