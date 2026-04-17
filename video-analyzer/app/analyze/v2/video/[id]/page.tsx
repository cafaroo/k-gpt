import { redirect } from "next/navigation";
import { v2Session as auth } from "@/lib/video/v2/session";
import { EmotionalArcChart } from "@/components/video/emotional-arc-chart";
import { HookDissectionCard } from "@/components/video/hook-dissection-card";
import { MicroMomentsCard } from "@/components/video/micro-moments-card";
import { PacingCurve } from "@/components/video/pacing-curve";
import { PatternInterruptsCard } from "@/components/video/pattern-interrupts-card";
import { PlatformFitCard } from "@/components/video/platform-fit-card";
import { SwipeRiskCurve } from "@/components/video/swipe-risk-curve";
import { TrustSignalsCard } from "@/components/video/trust-signals-card";
import { InsightsRichCard } from "@/components/video/v2/insights-rich-card";
import { OverallScorecard } from "@/components/video/v2/overall-scorecard";
import { PlatformFitRadar } from "@/components/video/v2/platform-fit-radar";
import { RuleComplianceRadar } from "@/components/video/v2/rule-compliance-radar";
import { VisualCharacterRadar } from "@/components/video/v2/visual-character-radar";
import { PerVideoClient } from "@/components/video/v2/per-video-client";
import { getAnalysisById } from "@/lib/db/queries";

export default async function PerVideoPage({
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

      {fullPayload && (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tier 1 · Attention capture (0-3s)
            </h2>
            {fullPayload.extended?.hookDissection && (
              <HookDissectionCard
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
            {fullPayload.extended?.patternInterrupts && (
              <PatternInterruptsCard
                patternInterrupts={fullPayload.extended.patternInterrupts}
              />
            )}
            {/* AudioLandscapeExpanded is rendered in PerVideoClient above */}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tier 3 · Outcome signals
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {fullPayload.extended?.trustSignals && (
                <TrustSignalsCard
                  trustSignals={fullPayload.extended.trustSignals}
                />
              )}
              {fullPayload.extended?.microMoments && (
                <MicroMomentsCard
                  microMoments={fullPayload.extended.microMoments}
                />
              )}
            </div>
            {fullPayload.extended?.platformFit && (
              <PlatformFitCard platformFit={fullPayload.extended.platformFit} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
