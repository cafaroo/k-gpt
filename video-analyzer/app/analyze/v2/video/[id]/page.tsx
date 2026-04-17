import { redirect } from "next/navigation";
import { Suspense } from "react";
import { v2Session as auth } from "@/lib/video/v2/session";
import { EmotionalArcChart } from "@/components/video/emotional-arc-chart";
import { PacingCurve } from "@/components/video/pacing-curve";
import { PlatformFitCard } from "@/components/video/platform-fit-card";
import { SwipeRiskCurve } from "@/components/video/swipe-risk-curve";
import { AudienceProfileCard } from "@/components/video/v2/audience-profile-card";
import { EyeContactChart } from "@/components/video/v2/eye-contact-chart";
import { ExportButton } from "@/components/video/v2/export-button";
import { HookDissectionV2Card } from "@/components/video/v2/hook-dissection-v2-card";
import { InsightsRichCard } from "@/components/video/v2/insights-rich-card";
import { OverallScorecard } from "@/components/video/v2/overall-scorecard";
import { PeopleAnalysisCard } from "@/components/video/v2/people-analysis-card";
import { PlatformFitRadar } from "@/components/video/v2/platform-fit-radar";
import { PredictedMetricsGridV2 } from "@/components/video/v2/predicted-metrics-grid-v2";
import { RuleComplianceRadar } from "@/components/video/v2/rule-compliance-radar";
import { ScriptAngleCard } from "@/components/video/v2/script-angle-card";
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
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold truncate">{v.filename}</h2>
        <ExportButton
          href={`/analyze/v2/api/analyses/${a.id}/export`}
          label="Export ZIP"
        />
      </div>

      {/* Batch 2: client wrapper owns VideoWithOverlay + all timeline/seek components
          (including EventsTimeline which needs onSeek) */}
      <PerVideoClient fullPayload={fullPayload} video={v} />

      {/* Overall scorecard */}
      {fullPayload && <OverallScorecard analysis={fullPayload} />}

      {/* Batch 4: Script angle — near overall scorecard */}
      {fullPayload?.extended?.scriptAngle && (
        <ScriptAngleCard
          scriptAngle={fullPayload.extended.scriptAngle}
          totalDuration={Number(v.durationSec ?? 0)}
        />
      )}

      {/* Rich insights */}
      {fullPayload?.insights && (
        <InsightsRichCard insights={fullPayload.insights} />
      )}

      {/* Batch 4: Audience profile — near insights */}
      {fullPayload?.audienceProfile && (
        <AudienceProfileCard audienceProfile={fullPayload.audienceProfile} />
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
              {/* Batch 4: Eye contact alongside emotional arc */}
              {fullPayload.extended?.eyeContact && (
                <EyeContactChart eyeContact={fullPayload.extended.eyeContact} />
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

          {/* Batch 4: People analysis — own section */}
          {fullPayload.extended?.peopleAnalysis && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                People Analysis
              </h2>
              <PeopleAnalysisCard
                peopleAnalysis={fullPayload.extended.peopleAnalysis}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
