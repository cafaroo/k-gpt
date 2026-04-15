"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
};

export function RuleComplianceCard({ analysis }: Props) {
  const rules = analysis.ruleCompliance;
  if (rules.length === 0) {
    return null;
  }

  const metCount = rules.filter((r) => r.met).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Rule compliance</CardTitle>
        <span className="text-muted-foreground text-xs">
          {metCount}/{rules.length} met
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rules.map((r) => (
          <div
            className="flex items-start gap-2 rounded border-l-2 px-2 py-1.5 text-xs"
            key={r.ruleId}
            style={{
              borderLeftColor: r.met ? "rgb(16 185 129)" : "rgb(239 68 68)",
            }}
          >
            <span
              className={`mt-0.5 shrink-0 ${r.met ? "text-emerald-500" : "text-red-500"}`}
            >
              {r.met ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.title}</span>
                {r.score !== undefined && (
                  <span className="text-muted-foreground shrink-0">
                    {r.score}/10
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 leading-snug">
                {r.evidence}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function NichePlaybookCard({ analysis }: Props) {
  const niche = analysis.niche;
  if (niche.playbookCompliance.length === 0) {
    return null;
  }

  const metCount = niche.playbookCompliance.filter((c) => c.met).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">
          Niche playbook ·{" "}
          <span className="text-primary">{niche.detected}</span>
        </CardTitle>
        <span className="text-muted-foreground text-xs">
          {metCount}/{niche.playbookCompliance.length} met
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {niche.playbookCompliance.map((c) => (
          <div className="flex items-start gap-2 text-xs" key={c.ruleId}>
            <span
              className={`mt-0.5 shrink-0 ${c.met ? "text-emerald-500" : "text-red-500"}`}
            >
              {c.met ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </span>
            <div>
              <span className="font-medium">{c.label}</span>
              <p className="text-muted-foreground leading-snug">{c.note}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}/10</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PerformancePredictionCard({ analysis }: Props) {
  const m = analysis.predictedMetrics;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Performance prediction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <MetricBar label="Hold to 3s" value={m.holdTo3sScore} />
        <MetricBar label="Save likelihood" value={m.saveLikelihood} />
        <MetricBar label="Comment likelihood" value={m.commentLikelihood} />
        <MetricBar label="Share likelihood" value={m.shareLikelihood} />
        <p className="text-muted-foreground pt-1 text-xs italic leading-relaxed">
          {m.rationale}
        </p>
      </CardContent>
    </Card>
  );
}
