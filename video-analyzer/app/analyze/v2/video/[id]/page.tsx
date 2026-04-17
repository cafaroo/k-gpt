import { redirect } from "next/navigation";
import { Suspense } from "react";
import { v2Session as auth } from "@/lib/video/v2/session";
import { EmotionalArcChart } from "@/components/video/emotional-arc-chart";
import { PacingCurve } from "@/components/video/pacing-curve";
import { PlatformFitCard } from "@/components/video/platform-fit-card";
import { SwipeRiskCurve } from "@/components/video/swipe-risk-curve";
import { EventsTimeline } from "@/components/video/v2/events-timeline";
import { HookDissectionV2Card } from "@/components/video/v2/hook-dissection-v2-card";
import { InsightsRichCard } from "@/components/video/v2/insights-rich-card";
import { OverallScorecard } from "@/components/video/v2/overall-scorecard";
import { PlatformFitRadar } from "@/components/video/v2/platform-fit-radar";
import { PredictedMetricsGridV2 } from "@/components/video/v2/predicted-metrics-grid-v2";
import { RuleComplianceRadar } from "@/components/video/v2/rule-compliance-radar";
import { VisualCharacterRadar } from "@/components/video/v2/visual-character-radar";
import { PerVideoClient } from "@/components/video/v2/per-video-client";
import { getAnalysisById } from "@/lib/db/queries";

export default function PerVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PerVideoSkeleton />}>
      <PerVideoBody params={params} />
    </Suspense>
  );
}

function PerVideoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="aspect-video md:aspect-auto md:h-[380px] rounded-lg border bg-muted/30 animate-pulse" />
      <div className="h-44 rounded-lg border bg-muted/30 animate-pulse" />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="h-64 rounded-lg border bg-muted/30 animate-pulse" />
        <div className="h-64 rounded-lg border bg-muted/30 animate-pulse" />
        <div className="h-64 rounded-lg border bg-muted/30 animate-pulse" />
      </div>
    </div>
  );
}

async function PerVideoBody({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { id } = await params;
  const row = await getAnalysisById(id, session.user.id);
  if (!row) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Analysis not found.
      </div>
    );
  }
  const a = row.Analysis;
  const v = row.Video;

  let fullPayload: any = null;
  if (a.analysisBlobUrl) {
    try {
      const res = await fetch(a.analysisBlobUrl);
      if (res.ok) {
        fullPayload = await res.json();
      }
    } catch {
      // no-op
    }
  }

  return (
    <div className="space-y-6">
      {/* Batch 2: client wrapper owns VideoWithOverlay + all timeline/seek components */}
      <PerVideoClient fullPayload={fullPayload} video={v} />

      {/* Timed events overview (interrupts + trust signals + micro-moments) */}
      {fullPayload && (
        <EventsTimeline
          patternInterrupts={fullPayload.extended?.patternInterrupts}
          trustSignals={fullPayload.extended?.trustSignals}
          microMoments={fullPayload.extended?.microMoments}
          totalDuration={Number(v.durationSec ?? 0)}
        />
      )}

      {/* Overall scorecard */}
      {fullPayload && <OverallScorecard analysis={fullPayload} />}

      {/* Rich insights */}
      {fullPayload?.insights && (
        <InsightsRichCard insights={fullPayload.insights} />
      )}

      {/* Three-way radar grid */}
      {fullPayload && (
        <div className="grid md:grid-cols-3 gap-4">
          <RuleComplianceRadar rules={fullPayload.ruleCompliance ?? []} />
          <VisualCharacterRadar payload={fullPayload} />
          <PlatformFitRadar platformFit={fullPayload.extended?.platformFit} />
        </div>
      )}

      {/* Predicted metrics v2 */}
      {fullPayload?.predictedMetrics && (
        <PredictedMetricsGridV2 metrics={fullPayload.predictedMetrics} />
      )}

      {fullPayload && (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tier 1 · Attention capture (0-3s)
            </h2>
            {fullPayload.extended?.hookDissection && (
              <HookDissectionV2Card
                hookDissection={fullPayload.extended.hookDissection}
                hookDuration={fullPayload.hook?.duration}
              />
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tier 2 · Sustained engagement
            </h2>
            <PacingCurve analysis={fullPayload} />
            <div className="grid md:grid-cols-2 gap-4">
              {fullPayload.extended?.swipeRiskCurve && (
                <SwipeRiskCurve
                  swipeRiskCurve={fullPayload.extended.swipeRiskCurve}
                />
              )}
              {fullPayload.extended?.emotionalArc && (
                <EmotionalArcChart
                  emotionalArc={fullPayload.extended.emotionalArc}
                />
              )}
            </div>
            {/* AudioLandscapeV2 is rendered in PerVideoClient above */}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tier 3 · Outcome signals
            </h2>
            {fullPayload.extended?.platformFit && (
              <PlatformFitCard platformFit={fullPayload.extended.platformFit} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
