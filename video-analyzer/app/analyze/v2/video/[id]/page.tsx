import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AudioInsightsV2 } from "@/components/video/audio-insights-v2";
import { EmotionalArcChart } from "@/components/video/emotional-arc-chart";
import { HookDissectionCard } from "@/components/video/hook-dissection-card";
import { MicroMomentsCard } from "@/components/video/micro-moments-card";
import { PacingCurve } from "@/components/video/pacing-curve";
import { PatternInterruptsCard } from "@/components/video/pattern-interrupts-card";
import { PlatformFitCard } from "@/components/video/platform-fit-card";
import { SwipeRiskCurve } from "@/components/video/swipe-risk-curve";
import { TrustSignalsCard } from "@/components/video/trust-signals-card";
import { ResearchRow } from "@/components/video/v2/research-row";
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
      <div className="grid md:grid-cols-[2fr_3fr] gap-6">
        <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden">
          {/* biome-ignore lint/a11y/useMediaCaption: no caption for POC */}
          <video
            className="h-full w-full object-contain"
            controls
            src={v.blobUrl}
          />
        </div>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold">{v.filename}</h1>
          <div className="text-sm text-muted-foreground">
            {fullPayload?.overall?.tagline ?? "—"}
          </div>
          <div className="text-sm">{fullPayload?.overall?.summary ?? ""}</div>
        </div>
      </div>

      <ResearchRow
        authenticityBand={a.authenticityBand}
        colloquiality={a.colloquialityScore ? Number(a.colloquialityScore) : 0}
        ecr={a.ecr ? Number(a.ecr) : 0}
        ecrRationale={fullPayload?.researchMeta?.ecr?.rationale}
        nawp={a.nawp ? Number(a.nawp) : 0}
        nawpRationale={fullPayload?.researchMeta?.nawp?.rationale}
      />

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
            {fullPayload.extended?.audioExtended && (
              <AudioInsightsV2
                audioExtended={fullPayload.extended.audioExtended}
              />
            )}
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
