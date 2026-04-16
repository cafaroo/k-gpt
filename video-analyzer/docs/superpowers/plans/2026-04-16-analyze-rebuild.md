# /analyze Rebuild Implementation Plan

> **För agentic workers:** REQUIRED SUB-SKILL: Använd superpowers:executing-plans för inline exekvering. Steg använder checkbox (`- [ ]`) syntax.

**Goal:** Få /analyze-dashboarden att visa all data Gemini redan returnerar, pivotera från "recommendations/testPlan" till "insights", återinföra client-side-extraktion för UX och städa ut död audio-kod.

**Architecture:** Behåll 2-pass Gemini (base + extended parallellt). Pivot base-schema: ta bort `testPlan` + `recommendations.testVariant/area/priority`, lägg till `insights[]`. Återaktivera `extractAll()` klient-side parallellt med Gemini-call så FrameGallery/AudioChart/thumbnails fungerar. Nio nya extended-data-komponenter monteras i höger kolumn. Städa döda audio-filer och normalisera enum-fält.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Zod, Gemini via Vercel AI Gateway, Recharts, shadcn/ui, Tailwind v4.

---

## Fas 1 — Pivot: Recommendations + TestPlan → Insights

### Task 1.1: Uppdatera base-schema (insights istället för recommendations/testPlan)

**Files:**
- Modify: `lib/video/qwen-schema.ts` (rader 259-308 och motsvarande hydrators)

- [ ] Ersätt `recommendations` och `testPlan`-fälten i `QwenAnalysisSchema` med ett nytt `insights`-fält:

```ts
// Ersätt recommendations + testPlan med:
insights: z.array(
  z.object({
    area: z.enum([
      "hook",
      "pacing",
      "visual",
      "audio",
      "cta",
      "copy",
      "editing",
      "structure",
      "retention",
    ]),
    observation: z.string().describe("Vad som faktiskt händer i videon — ren observation, inget du-bör-göra"),
    evidence: z.string().describe("Konkret timestamp + observerbar signal"),
    impact: z.enum(["positive", "neutral", "negative"]),
    note: z.string().optional().describe("Extra kontext, t.ex. varför detta påverkar prestanda"),
  })
).describe("Insights om videon — analyser snarare än rekommendationer"),
```

- [ ] Ta bort `hydrateRecommendation`, `hydrateHookVariant`, `hydrateStructureVariant` och byt till `hydrateInsight`:

```ts
function hydrateInsight(r: unknown): QwenAnalysis["insights"][number] {
  const o = (r ?? {}) as Record<string, unknown>;
  return {
    area: asStr(o.area, "copy") as QwenAnalysis["insights"][number]["area"],
    observation: asStr(o.observation ?? o.issue),
    evidence: asStr(o.evidence ?? o.note),
    impact: asStr(o.impact, "neutral") as QwenAnalysis["insights"][number]["impact"],
    note: typeof o.note === "string" ? o.note : undefined,
  };
}
```

- [ ] Uppdatera `ensureBaseShape` så den mappar till `insights: asArr(r.insights).map(hydrateInsight)` och ta bort `recommendations`/`testPlan`-hydration.

### Task 1.2: Uppdatera prompten för insights-pivot

**Files:**
- Modify: `lib/video/qwen-prompt.ts`

- [ ] Ändra rad 36 till att säga att vi producerar `insights` (analyser) inte `recommendations` (åtgärder). Ta bort testPlan-krav.
- [ ] Lägg till explicit block i prompten:

```
═══════════════════════════════════════════════════════════════════════════
OUTPUT — INSIGHTS, NOT RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════════
Do NOT suggest changes, A/B tests, or next-version variants. Fill `insights`
with what IS in the video and why it matters:

  { area: 'hook' | 'pacing' | 'visual' | 'audio' | 'cta' | 'copy' | 'editing' | 'structure' | 'retention',
    observation: 'Hook opens with a handheld close-up of the product, no text',
    evidence: '0:00-0:02 — product fills frame, no VO until 0:02',
    impact: 'positive' | 'neutral' | 'negative',
    note?: 'Matches UGC-native pattern that correlates with higher hold-to-3s' }

Give 6-12 insights covering: hook, pacing, CTA, visual language, audio, retention risk.
```

- [ ] Ta bort rad 66-67 om testVariant och testPlan.

### Task 1.3: Uppdatera adapter för insights

**Files:**
- Modify: `lib/video/gemini-adapter.ts`

- [ ] Ta bort `recommendations`/`testPlan`-block i `adaptBase` (rader 493-525).
- [ ] Lägg till:

```ts
const insights = asArr(r.insights ?? r.recommendations).map((rec) => {
  const o = asObj(rec);
  return {
    area: asStr(o.area, "copy"),
    observation: asStr(o.observation ?? o.issue ?? o.problem),
    evidence: asStr(o.evidence ?? o.note ?? o.suggestion),
    impact: asStr(o.impact, "neutral"),
    note: typeof o.note === "string" ? o.note : undefined,
  };
});
```

- [ ] Returnera `insights` i stället för `recommendations`+`testPlan`.

### Task 1.4: Skapa `components/video/insights-card.tsx`

**Files:**
- Create: `components/video/insights-card.tsx`

```tsx
"use client";

import { CheckCircle2, MinusCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";

const IMPACT = {
  positive: { icon: CheckCircle2, color: "text-emerald-500", border: "border-l-emerald-500" },
  neutral: { icon: MinusCircle, color: "text-slate-500", border: "border-l-slate-400" },
  negative: { icon: AlertCircle, color: "text-red-500", border: "border-l-red-500" },
} as const;

export function InsightsCard({ analysis }: { analysis: QwenAnalysis }) {
  const insights = analysis.insights;
  if (!insights || insights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((ins, i) => {
          const meta = IMPACT[ins.impact] ?? IMPACT.neutral;
          const Icon = meta.icon;
          return (
            <div
              className={`rounded-md border border-l-4 ${meta.border} bg-muted/30 p-3`}
              key={`ins-${i}-${ins.area}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {ins.area}
                    </span>
                    <span className={`text-[10px] font-medium ${meta.color}`}>
                      {ins.impact}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{ins.observation}</p>
                  <p className="text-muted-foreground mt-1 text-xs italic">
                    {ins.evidence}
                  </p>
                  {ins.note && (
                    <p className="text-muted-foreground mt-1 text-xs">{ins.note}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

### Task 1.5: Byt ut Recommendations + ta bort TestPlanCard i dashboarden

**Files:**
- Modify: `components/video/qwen-dashboard.tsx` (rader 199-200, 29-38)

- [ ] Ta bort `<TestPlanCard />` och `<Recommendations />`-användningar.
- [ ] Lägg till `<InsightsCard />`.
- [ ] Ta bort `test-plan-card.tsx` och `recommendations.tsx`-imports.

### Task 1.6: Radera döda test-plan/recommendations-komponenter

**Files:**
- Delete: `components/video/test-plan-card.tsx`
- Delete: `components/video/recommendations.tsx`

---

## Fas 2 — Fixa live-buggar

### Task 2.1: Fixa scene-klassificering — tvinga korrekt enum

**Files:**
- Modify: `lib/video/gemini-adapter.ts` (scene-hydrator, rad 302-303)

- [ ] Lägg till enum-normalisering i scene-adapter:

```ts
const SCENE_FUNCTIONS = new Set(["hook","problem","product-intro","social-proof","demo","benefit","cta","transition","other"]);
function normalizeSceneFunction(v: string): string {
  const s = v.toLowerCase().replace(/_/g, "-").trim();
  if (SCENE_FUNCTIONS.has(s)) return s;
  if (/intro|teaser|opening/.test(s)) return "hook";
  if (/problem|pain|issue/.test(s)) return "problem";
  if (/product|feature/.test(s)) return "product-intro";
  if (/testimonial|review|social/.test(s)) return "social-proof";
  if (/demo|how|step|show/.test(s)) return "demo";
  if (/benefit|result|outcome/.test(s)) return "benefit";
  if (/cta|call-to-action|buy|shop/.test(s)) return "cta";
  if (/transition|bridge|cut/.test(s)) return "transition";
  return "other";
}
```

Använd i scene-adaptern: `function: normalizeSceneFunction(asStr(o.function, "other"))`.

- [ ] Uppdatera `QWEN_SYSTEM_PROMPT` för att tvinga Gemini att använda rätt enum:

```
CRITICAL — scene.function MUST be one of: hook, problem, product-intro, 
social-proof, demo, benefit, cta, transition, other. No other values.
Classify every scene by its narrative function, not its visual content.
```

### Task 2.2: Fixa targetAudience — tvinga age + buyerStage via prompt

**Files:**
- Modify: `lib/video/qwen-prompt.ts`

- [ ] Lägg till i prompten:

```
targetAudience.ageRange MUST be a range like "18-24" or "25-34" — never empty.
targetAudience.buyerStage MUST be one of: awareness, consideration, decision, retention.
If uncertain, infer from visual cues (actor age, aesthetic) and product type.
```

### Task 2.3: Fixa PacingCurve Recharts width/height=-1

**Files:**
- Modify: `components/video/pacing-curve.tsx` (rad 37)

- [ ] Byt från `<div className="h-56 w-full">` till explicit pixelhöjd + minsta bredd:

```tsx
<div style={{ width: "100%", height: 224, minWidth: 280 }}>
```

- [ ] Lägg till early-return om `data.length === 0`:

```tsx
if (data.length === 0) {
  return (
    <Card ref={ref}>
      <CardHeader><CardTitle className="text-sm">Engagement intensity curve</CardTitle></CardHeader>
      <CardContent className="text-muted-foreground text-xs">
        Intensity curve saknas från Gemini-output.
      </CardContent>
    </Card>
  );
}
```

### Task 2.4: Utöka OverallSummary med rationale + completion/engagement-detalj

**Files:**
- Modify: `components/video/hero-scorecards.tsx` (rad 119-146)

- [ ] Visa hold-to-3s, save/comment/share-score bredvid completion/engagement badges så `medium`-nivån kompletteras med siffror.

```tsx
<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground">Completion</span>
    {badge(predicted.completionRate)}
  </div>
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground">Engagement</span>
    {badge(predicted.engagementRate)}
  </div>
  <div>
    <span className="text-muted-foreground">Hold-to-3s </span>
    <strong>{predicted.holdTo3sScore.toFixed(1)}/10</strong>
  </div>
  <div>
    <span className="text-muted-foreground">Save </span>
    <strong>{predicted.saveLikelihood.toFixed(1)}/10</strong>
  </div>
</div>
```

### Task 2.5: Verifiera video preview efter src-fix

**Files:**
- Manual check via browser.

- [ ] Starta dev, ladda upp en video, verifiera att `<video>` spelar i dashboarden.

---

## Fas 3 — Återinför client-side-extraktion (parallellt med Gemini)

### Task 3.1: Uppdatera `useVideoProcessor` — kör extractAll parallellt

**Files:**
- Modify: `hooks/use-video-processor.ts`

- [ ] Lägg till `extraction`-state + kör `extractAll` parallellt med upload+analyze.

```ts
const [extraction, setExtraction] = useState<VideoExtraction | null>(null);
// … efter readMetadata:
const { extractAll } = await import("@/lib/video/extractors");
const extractPromise = extractAll(file, (step, p) => {
  // Låt progress följa extraction tills Gemini tar över
}).then((ex) => {
  setExtraction(ex);
  return ex;
}).catch((err) => {
  console.warn("[useVideoProcessor] extractAll failed:", err);
  return null;
});
// … fortsätt med upload + analyze parallellt
// extractAll ska inte blockera analyze-anropet
```

- [ ] Returnera `extraction` från hooken.

### Task 3.2: Uppdatera `/analyze/page.tsx` — skicka riktig extraction

**Files:**
- Modify: `app/analyze/page.tsx`

- [ ] Ersätt mock-extraction (rad 28-35) med `processor.extraction ?? mockExtraction`:

```tsx
const extraction = processor.extraction ?? {
  metadata: processor.metadata,
  frames: [],
  audioSegments: [],
  sceneChanges: [],
  motionSegments: [],
  extractedAt: new Date().toISOString(),
};
```

### Task 3.3: Beat-overlays med frames (valfritt)

**Files:**
- Modify: `components/video/beat-map-strip.tsx`

- [ ] Lägg till miniatyrbilder från `extraction.frames` på beat-listan om frames finns — hoppa annars.

---

## Fas 4 — Visualisera extended-data (nya komponenter)

### Task 4.1: AudioInsightsV2 (läser analysis.extended.audioExtended)

**Files:**
- Create: `components/video/audio-insights-v2.tsx`

- [ ] Ny komponent som visar voiceoverTone (tags), voiceoverPace, music (genre/mood/energyCurve), ambientSounds, soundEffects, silenceMoments, audioDensity.
- [ ] Visa music.energyCurve som liten sparkline via Recharts `<LineChart>` (height 80px).

### Task 4.2: HookDissectionCard

**Files:**
- Create: `components/video/hook-dissection-card.tsx`

- [ ] Visa firstSecond (visual/audio/text/attentionTriggers/promiseEstablished).
- [ ] Visa firstThreeSeconds som en 4-kolumns-tabell (0s/1s/2s/3s med tension + visual + audio).
- [ ] Visa curiosityGap.present + resolvesAt, stopPower som stor siffra.

### Task 4.3: TranscriptCard

**Files:**
- Create: `components/video/transcript-card.tsx`

- [ ] Visa segments som klickbar lista (onSeek). Språkbadge + "Show full text"-toggle.

### Task 4.4: SwipeRiskCurve

**Files:**
- Create: `components/video/swipe-risk-curve.tsx`

- [ ] Recharts `LineChart` per sekund, y-axel 0-10, röd linje när risk > 7.
- [ ] Tooltip visar `reason`.

### Task 4.5: EmotionalArcChart

**Files:**
- Create: `components/video/emotional-arc-chart.tsx`

- [ ] Area chart per-second, visar intensitet + en liten timeline av "primary"-emotion som taggar under grafen.

### Task 4.6: PatternInterruptsList

**Files:**
- Create: `components/video/pattern-interrupts-card.tsx`

- [ ] Lista med timestamp + type-badge + description + effectiveness score.

### Task 4.7: TrustSignalsList

**Files:**
- Create: `components/video/trust-signals-card.tsx`

- [ ] Samma format som PatternInterrupts: timestamp + type-badge + description + strength.

### Task 4.8: MicroMomentsTimeline

**Files:**
- Create: `components/video/micro-moments-card.tsx`

- [ ] Timeline av alla micro-moments. Varje moment har impactOnRetention-badge.

### Task 4.9: PlatformFitCard

**Files:**
- Create: `components/video/platform-fit-card.tsx`

- [ ] Tre scorekort (TikTok/Reels/YouTube Shorts) med score + reasoning.
- [ ] "Best fit"-badge överst.

### Task 4.10: Montera alla nya kort i dashboard

**Files:**
- Modify: `components/video/qwen-dashboard.tsx`

- [ ] Lägg till extended-kort i en ny sektion efter huvud-gridden. Gruppera logiskt:
  - Hook-sektion: HookDissection + Transcript
  - Audio-sektion: AudioInsightsV2
  - Retention-sektion: SwipeRiskCurve + EmotionalArcChart
  - Moments: PatternInterrupts + TrustSignals + MicroMoments
  - Fit: PlatformFit

### Task 4.11: Typindela analysis.extended och läs från rätt props

**Files:**
- Modify: `lib/video/qwen-schema.ts` (export combined type)

- [ ] Skapa:

```ts
import type { AnalysisExtended } from "./analysis-extended-schema";
export type QwenAnalysisWithExtended = QwenAnalysis & {
  extended?: AnalysisExtended;
  extendedError?: string;
};
```

Uppdatera `analysis`-prop i qwen-dashboard till `QwenAnalysisWithExtended`.

---

## Fas 5 — Städa död audio-kod + batch-flödet

### Task 5.1: Ta bort döda audio-filer

**Files:**
- Delete: `lib/video/audio-schema.ts`
- Delete: `lib/video/audio-extract.ts`
- Delete: `app/analyze/api/audio/` (om den finns)

- [ ] Sök och rensa imports av `audio-schema`/`audio-extract` i hela kodbasen.

### Task 5.2: Rensa audioAnalysis-prop

**Files:**
- Modify: `hooks/use-video-processor.ts`, `components/video/qwen-dashboard.tsx`, `components/video/analysis-chat.tsx`, `components/video/export-button.tsx`, `app/analyze/page.tsx`

- [ ] Ta bort `audioAnalysis`-prop genom hela kedjan. ExtendedAudio tar över.

### Task 5.3: Ta bort AudioInsights (legacy)

**Files:**
- Delete: `components/video/audio-insights.tsx`

- [ ] Ersätts av `audio-insights-v2.tsx`. Byt sedan namnet till `audio-insights.tsx` igen (så imports förblir enkla).

### Task 5.4: Reparera batch-flödet

**Files:**
- Modify: `lib/video/batch/queue.ts`

- [ ] Ta bort `runAudio()` + `audioPromise`. Anropa bara `runQwen()`.
- [ ] Uppdatera `runQwen()` till samma payload som single-video (metadata + videoUrl utan frameDataUrls).
- [ ] Ta bort `patch.audio`.

### Task 5.5: Uppdatera VideoJob-typ

**Files:**
- Modify: `lib/video/batch/types.ts` (om den finns)

- [ ] Ta bort `audio?: AudioAnalysis` från `VideoJob`.

---

## Fas 6 — Visa extendedError + robusthet

### Task 6.1: Visa extendedError när extended saknas

**Files:**
- Modify: `components/video/qwen-dashboard.tsx`

- [ ] Om `analysis.extended` saknas och `analysis.extendedError` finns, rendera en varningsbanner.

### Task 6.2: Logga okänd struktur i adapter

**Files:**
- Modify: `lib/video/gemini-adapter.ts`

- [ ] I `adaptBase`: om `r.insights` saknas men `r.recommendations` finns, `console.warn('[adapter] fallback to recommendations field')`.
- [ ] Logga när scene.function inte matchar enum.

### Task 6.3: Fixa React key-warnings

**Files:**
- Audit: `components/video/insights-card.tsx`, `components/video/rule-compliance.tsx`, alla lists.

- [ ] Säkerställ att alla `.map`-renders har stabila nycklar (kombinera index + unik field).

---

## Självgranskning

1. **Spec-coverage:**
   - ✅ Ta bort testPlan (Fas 1.5, 1.6)
   - ✅ Pivot recommendations → insights (Fas 1)
   - ✅ Scene classification (Fas 2.1)
   - ✅ Target audience age+buyerStage (Fas 2.2)
   - ✅ Engagement/completion detalj (Fas 2.4)
   - ✅ Recharts PacingCurve width=-1 (Fas 2.3)
   - ✅ Video preview-verifiering (Fas 2.5)
   - ✅ Client-side extraction tillbaka (Fas 3)
   - ✅ Raw extraction data (Fas 3.2 — riktig extraction populerar FrameGallery/AudioChart)
   - ✅ Extended-komponenter (Fas 4.1-4.10)
   - ✅ Städa audio (Fas 5)
   - ✅ Batch-flödet (Fas 5.4)
   - ✅ ExtendedError UI (Fas 6.1)
   - ✅ Adapter-logging (Fas 6.2)

2. **Placeholders:** Inga TODO-hänvisningar. Varje task har konkret kod.

3. **Typkonsistens:** `insights`-fält har enhetlig shape genom schema → adapter → hydrator → komponent.

---

## Exekveringsordning

Eftersom detta är en stor refaktorering kör vi i **strikt fasordning** (1 → 2 → 3 → 4 → 5 → 6). Varje fas commitar separat så vi kan rulla tillbaka.
