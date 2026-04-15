"use client";

import { FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

type Props = {
  analysis: QwenAnalysis;
};

export function TestPlanCard({ analysis }: Props) {
  const plan = analysis.testPlan;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <FlaskConical className="text-primary h-4 w-4" />
        <CardTitle className="text-sm">Ship next week — A/B variants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hook variants */}
        <div>
          <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            3 hook drafts
          </h4>
          <div className="space-y-2">
            {plan.hookVariants.map((v) => (
              <div
                className="rounded border-l-2 border-primary/60 bg-muted/30 px-3 py-2 text-sm"
                key={v.draft}
              >
                <div className="text-primary mb-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {v.style}
                </div>
                <p className="leading-snug">{v.draft}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Structure variants */}
        <div>
          <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            2 structure variants
          </h4>
          <div className="space-y-2">
            {plan.structureVariants.map((v) => (
              <div
                className="rounded border bg-muted/30 px-3 py-2 text-sm"
                key={v.name}
              >
                <div className="font-medium">{v.name}</div>
                <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Measurables */}
        {plan.measurablePriority.length > 0 && (
          <div>
            <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              Measure (in order)
            </h4>
            <div className="flex flex-wrap gap-1">
              {plan.measurablePriority.map((m) => (
                <span
                  className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium"
                  key={m}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {plan.notes && (
          <p className="text-muted-foreground text-xs italic leading-relaxed">
            {plan.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
