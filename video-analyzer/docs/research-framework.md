# UGC Shortform Video Analysis — Research-Backed Framework

**Status:** Research synthesis · Draft 2 (retrospective framing)
**Scope:** UGC-native shortform (TikTok / Reels / YouTube Shorts). Sources prioritized: peer-reviewed papers 2024–2026 and major arXiv preprints.
**Audience:** Contributors to `video-analyzer` evolving the analysis schema (`lib/video/qwen-schema.ts`, `lib/video/analysis-extended-schema.ts`) and the Gemini prompts (`lib/video/prompts.ts`, `lib/video/analysis-extended-prompt.ts`).

The goal of this document is to (a) anchor our schema in published, replicable measurement practice rather than folklore, (b) identify the 1–2 signals per dimension that actually correlate with engagement or purchase outcomes, and (c) flag the gaps where our current pipeline is weakest.

---

## 0. Retrospective, not predictive — read this first

This framework describes **extractable structural features** of a creative (hooks, beats, emotional arc, trust signals, pacing), not predictions of how it will perform. Evidence only emerges when those structural features are joined with **actual ad-platform performance data** (retention curve, CTR, CPM, CPA, ROAS from Meta Ads / TikTok Ads / YouTube).

The implied workflow is:

1. Editor ships a creative to production.
2. Ad platform delivers measured performance metrics (retention, engagement, spend, outcome) within an attribution window.
3. In the **weekly creative standup**, the team identifies "high risers" — creatives that broke performance baseline — and runs `video-analyzer` on those specifically.
4. The structural feature vector is extracted retrospectively; the matcher joins it against performance data (from CSV export or OAuth sync — see `performance-ingestion-architecture.md`).
5. The join — *this creative's structure × this creative's performance* — is the evidence.
6. The editor sees "videos with hook-pattern X + emotional-sequence Y held 3s-retention > 65%" and feeds that pattern into the next brief.

Implications that shape the rest of this document:

- Where older drafts said `predictedMetrics`, read it as `structuralSignals` that *can be calibrated against* observed performance, not as model-emitted predictions. See `performance-ingestion-architecture.md` for the ingestion side of the join.
- ECR and NAWP are **target variables** we overlay on the structural features, not outputs the LLM guesses. They arrive through the ingestion pipeline (CSV-primary, OAuth as P1 upgrade), not from Gemini.
- The analyzer's job is feature extraction with research-grounded primitives; the product's value is the retrospective join + pattern mining. Strong structural extraction with no performance overlay is an incomplete product.
- The invocation model is **standup-driven**, not batch. Analyses are run on high risers flagged during creative standups, not on the full creative backlog. See Section 6.4 for the detailed workflow. This means per-analysis quality matters more than throughput — each analyzed creative typically carries $300–500k+ in single-ad spend and feeds directly into the next brief cycle.

---

## 1. The research landscape at a glance

Three largely independent literatures converge on the short-form-UGC problem. Mapping our schema to them is how we avoid reinventing (or, worse, re-guessing) primitives that already have measurement protocols.

**(A) Creative-effectiveness / marketing-science.** Peer-reviewed work in *Journal of Business Research*, *Journal of Marketing*, *Journal of the Academy of Marketing Science*, *Journal of Advertising*. Measures outcomes like purchase intention, engagement behaviours (like/comment/save/share), and attentional synchrony. Uses grounded theory, SEM, eye-tracking, increasingly CV+DL feature extraction. Meng et al. (2024, JBR) and Zhang et al. (2025, JBR) are the most directly relevant recent examples.

**(B) Engagement prediction ML.** CV / multimodal ML community. Core question: given a video's raw pixels, audio, and metadata, can we predict engagement independent of the user/creator? Anchored by the **SnapUGC** dataset and the **VQualA 2025** ICCV challenge. Papers converge on the Engagement Continuation Rate (ECR, P(watch > 5s)) and Normalized Average Watch Percentage (NAWP) as the target metrics.

**(C) Narrative persuasion / affective science.** Communication and psych literatures on narrative transportation, emotional flow, and arousal-memory links. Tends not to touch code, but supplies the vocabulary for what our "emotionalArc", "beatMap", and "curiosityGap" fields are actually trying to measure.

Where the three literatures disagree, (B) tends to win on *can we measure it at scale*, (A) on *does this actually correlate with revenue*, and (C) on *what the underlying construct is called*.

---

## 2. What the research consistently finds

Five findings are robust enough that they should shape schema priorities, not just be reported as "insights":

**1. The first ~3 seconds are load-bearing and separately measurable.** Zhang, Hill et al. (2026, *Decoding the Hook*) build a dedicated multimodal LLM pipeline for just the "hooking period" (first 3s) and show correlations with conversion-per-investment. The VQualA 2025 winners (ECNU-SJTU, IMCL-DAMO) both report that early-frame quality dominates engagement prediction — consistent with ECR's 5-second threshold. Our `hook.duration`, `hook.timeToFirstVisualChange`, `hookDissection.firstSecond`, `hookDissection.firstThreeSeconds` are correctly pointed at this construct; the schema is appropriately granular.

**2. Audio is under-weighted by most models.** On SnapUGC, VideoLLaMA2 (audio+visual+language) "significantly outperforms" Qwen2.5-VL (visual+language only), attributed to audio carrying emotional atmosphere and narrative cues (Li et al., *Engagement Prediction of Short Videos with LMMs*, arXiv 2508.02516). Zhang et al. (2025, JBR) find **cadence** (speech rhythm) and **colloquial expression** among the strongest audiovisual predictors of likes/comments/saves/shares — colloquial style being the single strongest. Our `audioExtended` captures voiceoverTone/pace and music, but we have no colloquiality or cadence-quant field.

**3. Scene cuts and visual complexity drive attentional synchrony non-monotonically.** Journal of the Academy of Marketing Science (2025) — *The dynamic effects of visual complexity and scene cuts on viewer attention* — measures attentional synchrony at 30fps and shows cuts dynamically shape where viewers look. More cuts is not always better; the effect interacts with complexity. Our `pacing.cutsPerMinute` + `pacing.rhythm` is a crude summary; research-backed alternative is a per-second attentional-risk curve, which `swipeRiskCurve` partially covers.

**4. Trustworthiness, expertise, and attractiveness linearly raise purchase; authenticity and brand heritage are U-shaped.** Meng et al. (2024, JBR) analyze 2,578 TikTok videos (128 creators, grounded-theory dimensions). The U-shape for authenticity is the non-obvious result: *moderate* authenticity underperforms both polished and raw-authentic. Our `trustSignals` enumerates cues but does not score authenticity-level or brand-heritage salience, and we have no way to flag the U-shape risk zone.

**5. Emotional flow beats single-emotion arousal.** Frontiers in Communication (2025) demonstrates that sequenced emotional transitions (e.g., humor → sadness → hope) produce higher arousal than flat or two-step sequences, and arousal mediates attitude change. Narrative ads route through affective rather than cognitive processing (narrative transportation). Our `emotionalArc` array is structurally fine (per-1-2s primary emotion + intensity), but we do not score **transition quality** — the schema implicitly rewards intensity peaks over sequencing.

---

## 3. Metrics: what to standardize on

The ML literature has converged on a small set of engagement metrics that are cheap to validate when real platform data is available and directly usable as regression targets when it isn't.

**Primary proxies (use as dashboard KPIs):**

- **ECR — Engagement Continuation Rate.** Probability watch-time exceeds 5s. Dominant metric in VQualA 2025, Li et al. 2024, and follow-ups. Rationale: correlates with both algorithmic amplification and human stop-behaviour; largely duration-independent.
- **NAWP — Normalized Average Watch Percentage.** Min-max normalized watch percentage across the cohort. Handles the fact that 10s and 60s videos have very different baseline completion rates.
- **Completion Rate (video-length-bucketed).** Standard dashboard metric; only interpretable when bucketed (<15s, 15–30s, 30–60s) because of the duration bias NAWP is designed to correct.

**Secondary behavioural proxies (engagement-behaviours, from Zhang et al. 2025):**

- Like rate, comment rate, save/collect rate, share rate — all should be modeled separately because the Zhang 2025 features (colloquiality, cadence, colorfulness, visual prominence) weight differently per behaviour. Saves ≠ shares ≠ likes as signals of value.

**Outcome proxies (when creator-side attribution exists):**

- Purchase intent (Meng 2024 pipe) — hardest to approximate without survey or click-through data; best proxied through CTA strength × trust-signal density × payoff timing.
- Conversion-per-investment (CPI) — outcome anchor in Decoding the Hook (2026).

**Avoid as a target:** raw view count. It conflates distribution (algorithm-boosted) with quality; every engagement-prediction paper since 2024 explicitly argues against it.

Practical recommendation: rename the existing `predictedMetrics` bag to `structuralSignals` on the LLM-output side, and introduce a parallel `performanceMetrics` bag populated by the ingestion pipeline from ad-platform data. ECR and NAWP live in `performanceMetrics` (observed), while heuristic priors (`structuralSignals.ecrPrior`, `structuralSignals.nawpPrior`, 0–1) can live on the analyzer side as hand-weighted probes for debuggability — clearly marked as heuristics, not predictions. Keep the existing 0–10 save/share/comment likelihoods but annotate them as *Zhang-2025-behavioural-proxies* for clarity, and treat them as priors until retrospective join with real performance data recalibrates them.

---

## 4. Recommended framework — three tiers × three modalities

Organize the schema around **three measurement tiers** (when does the effect occur?) and **three modalities** (what is it measured from?). This is orthogonal enough to our current beatMap/emotionalArc structure that we can add it as an overlay rather than a rewrite.

### Tier 1 — Attention Capture (seconds 0–3)

The window where ECR is decided. Every Tier 1 feature should be measurable from the first 3 seconds alone.

| Construct | Research grounding | Schema location |
|---|---|---|
| First-frame visual change latency | Decoding the Hook (2026) — "hooking period" | `hook.timeToFirstVisualChange` (exists) |
| First-second stop-power signal | Hook dissection papers; VQualA early-frame finding | `extended.hookDissection.firstSecond` (exists) |
| Keyword-first text overlay | Meta/TikTok replicated finding; Zhang 2025 | `hook.textInFirstFrame.keywordFirst` (exists) |
| Curiosity gap presence + resolution distance | Narrative transportation literature | `extended.hookDissection.curiosityGap` (exists) |
| **Colloquial opening (missing)** | Zhang et al. 2025, JBR — strongest predictor | **Add** `extended.hookDissection.colloquialityScore` 0–10 |
| **Face/gaze lock in F1 (partially covered)** | Attentional synchrony lit (JAMS 2025) | Extend `visual.dominantFaceRatio` to per-segment |

### Tier 2 — Sustained Engagement (seconds 3 → end)

The window where NAWP and completion are decided. Tier 2 is where `pacing`, `emotionalArc`, `swipeRiskCurve`, and the full `beatMap` live.

| Construct | Research grounding | Schema location |
|---|---|---|
| Beat taxonomy (hook/problem/proof/demo/CTA) | Standard in creative-effectiveness lit | `beatMap[]` (exists, good taxonomy) |
| Per-second swipe risk | Attentional-synchrony 30fps methodology (JAMS 2025) | `extended.swipeRiskCurve[]` (exists) |
| Emotional sequencing (not just intensity) | Emotional Flow, Frontiers 2025 | **Add** `emotionalArc.transitionScore`: quality of sequencing (bigram/trigram evaluation against validated arcs like humor→sadness→hope) |
| Pattern interrupts as recapture events | Attentional-synchrony lit | `extended.patternInterrupts[]` (exists) |
| Audio cadence & voiceover density | Zhang et al. 2025 — cadence is a top predictor | `extended.audioExtended.voiceoverPace` (exists, but qualitative; **upgrade** to syllables/sec numeric) |
| Scene-cuts × visual-complexity interaction | JAMS 2025 — non-monotonic effect | **Add** `pacing.complexityAdjustedRhythm`: normalize cuts-per-minute by per-scene complexity |

### Tier 3 — Outcome Signals (post-view)

Features that predict like/save/share/comment/purchase *given* the viewer completed. This is where Meng 2024 and Decoding the Hook 2026 target their outcome models.

| Construct | Research grounding | Schema location |
|---|---|---|
| Trust cues enumerated & scored | Meng et al. 2024 — linear predictor of purchase | `extended.trustSignals[]` (exists) |
| **Authenticity level (U-shape risk)** | Meng et al. 2024 — U-shaped effect | **Add** `extended.authenticityBand`: {low / moderate-risk / high}. Moderate is the danger zone. |
| **Brand heritage salience** | Meng et al. 2024 — U-shaped effect | **Add** `extended.brandHeritageSalience`: {absent / moderate-risk / high} |
| CTA clarity × timing × ask-size | Standard CTA literature; Decoding the Hook CPI modeling | `cta.{clarity, timing, askSize}` (exists) |
| Payoff timing (early vs. delayed reveal) | Narrative transportation; VQualA early-frame finding | `payoffTiming` (exists — keep `isEarly`) |
| Colloquial expression overall | Zhang et al. 2025 — strongest single feature | **Add** `extended.colloquialityScore` at video level |

### Modality coverage

For each tier, every analysis run should emit signals derived from **all three modalities**. Audio is the most commonly missed — VideoLLaMA2 beats Qwen2.5-VL *because* of audio. Concretely: any prompt that strips the audio track before reasoning is leaving engagement signal on the floor.

- **Visual:** frame sampling + shot-boundary detection + dominant-face-ratio + visual complexity + colorfulness (Zhang 2025) + on-screen text.
- **Audio:** voiceover density & cadence + music energy + speech colloquiality + silence moments + sound-effects inventory.
- **Text:** transcript + on-screen text events + caption-vs-overlay consistency.

Our current `extended.audioExtended` and `extended.audioVisualSync` are correctly shaped for this; gaps are in quant rigor (qualitative tags vs. numeric features) rather than missing primitives.

---

## 5. Where the current POC is strong and where it's soft

**Strong:**

- Beat taxonomy (`beatMap[]`) maps directly to the standard creative-effectiveness vocabulary.
- Per-second/per-interval arrays (`swipeRiskCurve`, `emotionalArc`, `patternInterrupts`) align with the JAMS 2025 attentional-synchrony methodology. Our time resolution (1–2s) is coarser than their 30fps but appropriate given LLM costs.
- `payoffTiming.isEarly` directly encodes a result from the narrative-transportation literature.
- The existing `predictedMetrics` surface has the right shape to become the `structuralSignals` + `performanceMetrics` split — we don't need to demolish it, we need to relabel and source the observed side from ad-platform data.
- Two-pass Gemini design (base + extended) keeps Tier 1 (hook) and Tier 2/3 (body/outcome) separately debuggable.

**Soft spots — ordered by expected impact:**

1. **Audio under-weighted in prompts.** VideoLLaMA2's dominance on SnapUGC says audio is the single biggest unused modality. Audit the prompt stack: is the extended pass reasoning over the actual audio track, or about it from transcript? If the latter, we are reproducing Qwen2.5-VL's losing setup.
2. **Colloquiality is not scored.** Zhang et al. 2025 single it out as the strongest engagement-behaviour predictor across 4 outcome metrics. Add `colloquialityScore` (0–10) at the hook and video level, grounded in transcript analysis (informal markers, contractions, direct address).
3. **Authenticity is binary-ish.** Meng et al. 2024's U-shape result means our trust-signal scoring is mis-shaped for the construct. Add an `authenticityBand` that explicitly encodes the moderate-risk zone, not just "has trust signals / doesn't."
4. **Emotional sequencing is not scored.** We capture the arc but not whether the arc matches known high-performing patterns (emotional flow literature). A bigram/trigram match over the per-second `primary` field gets us 80% there cheaply.
5. **Pacing is length-normalized but not complexity-normalized.** Our `cutsPerMinute` is a single scalar; the JAMS 2025 result says we need cuts × complexity. Add `complexityAdjustedRhythm` or at minimum a per-scene complexity estimate we can interact with cut rate post-hoc.
6. **DOVER (or equivalent) not in the loop for technical-quality baseline.** DOVER (ICCV 2023) disentangles aesthetic vs. technical quality; VQualA 2025 top teams use it as one branch of a multi-branch model. For UGC, a "too-polished" or "too-blurry" flag from DOVER correlates with engagement and is a useful check on our qualitative `visual.mood` / `visual.variety`.
7. **Observed ECR / NAWP not yet ingested.** Structural extraction without retention-curve overlay is half the product. Performance ingestion (CSV-primary path + matcher → creative-ID-joined retention/CTR/CPA, OAuth as P1 upgrade) is the other half. See `performance-ingestion-architecture.md`.
8. **No retro-validation loop yet.** Even once performance data is ingested, we need the periodic scorer that correlates structural features against observed outcomes per brand, so `structuralSignals.ecrPrior` can be recalibrated from priors to brand-conditioned estimates.

---

## 6. Performance overlay layer — where the evidence comes from

Structural extraction (Sections 2–5) is half the framework. The other half is the **performance overlay**: joining each analyzed creative against observed ad-platform metrics so a feature vector becomes evidence.

### 6.1 What we overlay

For every creative analyzed by `video-analyzer`, we want a matching row of observed metrics. Minimum viable overlay:

- **Retention curve** — per-second or per-bucket watched-percentage curve, directly comparable to `swipeRiskCurve` and `emotionalArc` timestamps.
- **ECR (observed)** — P(view_duration ≥ 5s) aggregated over impressions in the attribution window.
- **NAWP (observed)** — normalized-average-watch-percentage, bucketed by video duration.
- **CTR** — outbound click / thumb-stop rate depending on platform surface.
- **CPA / ROAS** — the outcome anchors for `predictedMetrics`-style priors and the "was this creative worth running?" question.
- **Engagement-behaviour rates** — like / comment / save / share per 1k impressions, mapped to Zhang-2025-behavioural-proxies.

Each row is stamped with `source` (meta | tiktok | youtube | csv-import), `attributionWindow` (e.g. `7d-click-1d-view`), `impressions`, `spend`, and `ingestedAt`. Without these, comparisons across creatives or brands are meaningless.

### 6.2 How creatives get joined

The join key is a `creative_id` in our system that resolves to a specific Meta creative ID / TikTok creative ID / YouTube asset ID per platform. The linking layer is:

1. Editor uploads video to `video-analyzer` → we generate `analysis_id` and record a content hash.
2. Editor (or admin) attaches the Meta/TikTok/YouTube creative ID once the creative is deployed. Options: manual entry, filename-based matcher, content-hash matcher against platform asset metadata.
3. Ingestion worker pulls metrics for known creative IDs nightly, updates `performanceMetrics` on the matching analysis row.

Detail on OAuth, rate limits, fallback CSV import, and schema live in `performance-ingestion-architecture.md`.

### 6.3 What the retro-scorer does with the overlay

Once `structuralSignals` and `performanceMetrics` exist side-by-side:

- **Per-brand feature importance.** Regress observed ECR/CPA against structural features over that brand's last N creatives. Output per-brand weights: e.g. "for Ryze, `hookDissection.colloquialityScore` is the single largest positive predictor of 3s-retention; `emotionalArc.transitionScore` matters 2x for saves vs shares."
- **Editor-facing digest.** Convert per-brand weights into plain-language patterns: "your winners this quarter share a humor→curiosity→proof sequence and a colloquial F1 opening." This is the editor-learning-loop output.
- **Prior recalibration.** Replace hand-weighted `structuralSignals.ecrPrior` with brand-conditioned linear probes as the dataset grows. Each brand with ≥50 analyzed-and-ingested creatives gets its own probe; below that, use the global default.
- **Pattern surface for new briefs.** When editor starts a new brief in Notion, the plugin can pre-populate "your top-5 structural patterns for this product line" from the retro-scorer cache.

### 6.4 Invocation model — standup-driven, not batch

The framework is not invoked as "analyze everything." It is invoked selectively on **high risers** — creatives flagged during weekly creative standups because they broke performance baseline and the team needs to understand *why*.

**Typical weekly cycle:**

1. **Pre-standup (Sunday evening / Monday morning).** Performance lead exports last week's ad-platform data (CSV from Ads Manager, or auto-synced via OAuth) and scans for high risers — creatives that broke baseline on retention, CTR, CPA, or ROAS. In the UGC vertical, individual winning ads routinely carry $300–500k+ in spend, which means per-creative retention curves are statistically tight (millions of impressions), not noisy estimates. The lead flags 5–15 creatives for analysis.
2. **Analysis trigger.** Each flagged creative is run through the two-pass Gemini pipeline (base → extended) producing the structural feature vector. The performance overlay (from CSV or nightly sync) is joined by the matcher (`performance-ingestion-architecture.md` §4). Target: Pro analysis completes in ≤30 minutes so a batch of 10 can be prepped in a morning.
3. **Standup (15–45 min).** Team reviews each high riser with structural analysis and performance curve side-by-side. Discussion focuses on: which structural patterns (hook type, emotional sequence, trust signals, pacing) appear in this week's winners vs. losers? Are the patterns consistent with prior weeks' scorer weights?
4. **Post-standup.** Brief writers embed validated patterns into the next brief cycle. The feedback loop: structure → performance overlay → pattern extraction → brief → new creative → new performance → tighter patterns.

**Implications for framework design:**

- **Latency matters.** Pro analysis must tolerate "run 10 before the meeting" cadence. If analysis takes hours, it must be kicked off the night before; if it takes <10 minutes, it can be invoked on-the-fly when someone asks "wait, what about Ad 47?"
- **Results must be shareable.** Analyses are consumed *in the standup*, which means they must be screenshot-worthy, Notion/Slack-embeddable, and readable by non-technical editors. The `structuralSignals` vs `performanceMetrics` split in the schema is not just architectural — it is a presentational constraint: the CFO and the editor need to see that the performance half is real measurement, not model opinion.
- **Volume is lower, signal is higher.** A team may run 40–160 analyses per month, not thousands. But every analyzed creative is pre-filtered for relevance, typically carries hundreds of thousands in spend, and feeds directly into the next brief cycle. Quality of each analysis matters more than throughput.
- **"High Risers This Week" as adjacent feature.** A natural surface that auto-detects baseline-breaking creatives from the latest performance data and suggests them for analysis. This is retrospective alerting, not prediction — it says "here are things that happened that you should understand," not "here are things that will happen." Closes the loop between Motion-style dashboards (which show *which* ads won) and our framework (which explains *why*).

### 6.5 What retrospective-not-predictive forbids

- Do **not** ship a "will this win?" score in the UI even if the math supports it internally. The moment we do, we've re-entered the predictive category (Memorable AI, Neurons) and our positioning collapses.
- Do not let the LLM "score" retention or ROAS — those numbers must come from the ad-platform pipeline. LLM outputs are structural; platform outputs are observational.
- Do not blend structural and performance numbers into a single "score" in exported reports. Keep them visually separate so CFOs/editors can see that the performance half is real measurement, not model output. Evidence-based positioning depends on this distinction being visible.

---

## 7. Concrete recommendations

**Schema additions** (`analysis-extended-schema.ts`):

```ts
// In extended — new structural features
colloquialityScore: number;          // 0-10, transcript-derived
authenticityBand: 'low' | 'moderate' | 'high';  // Meng 2024 U-shape
brandHeritageSalience: 'absent' | 'moderate' | 'high';
hookDissection.colloquialityScore: number;      // 0-10, first-3s only
emotionalArc.transitionScore: number;           // 0-10, sequencing quality
pacing.complexityAdjustedRhythm: number;        // cuts-per-minute / mean_scene_complexity
audioExtended.voiceoverCadence: number;         // syllables-per-second, numeric not qualitative

// Rename predictedMetrics → structuralSignals (LLM-emitted heuristic priors)
structuralSignals.ecrPrior: number;       // 0-1, hand-weighted probe, NOT a prediction
structuralSignals.nawpPrior: number;      // 0-1, hand-weighted probe
structuralSignals.hookStrength: number;   // 0-10 from hook.score × first-3s features
structuralSignals.saveLikelihoodPrior: number;   // 0-10, Zhang-2025-weighted
structuralSignals.shareLikelihoodPrior: number;
structuralSignals.commentLikelihoodPrior: number;

// New — performanceMetrics (populated by ingestion pipeline, not by the LLM)
performanceMetrics.ecr: number | null;            // 0-1, observed P(watch > 5s)
performanceMetrics.nawp: number | null;           // 0-1, observed band
performanceMetrics.completionRate: number | null; // bucketed by duration
performanceMetrics.ctr: number | null;            // outbound / thumb-stop click rate
performanceMetrics.cpa: number | null;            // cost-per-action from platform
performanceMetrics.roas: number | null;
performanceMetrics.source: 'meta' | 'tiktok' | 'youtube' | 'csv-import';
performanceMetrics.attributionWindow: string;     // e.g. '7d-click-1d-view'
performanceMetrics.ingestedAt: string;            // ISO timestamp
```

The split is deliberate: anything under `structuralSignals` comes from the Gemini pass (pure-content analysis), anything under `performanceMetrics` comes from ad-platform ingestion. The `_Prior` suffix on structural-side engagement fields makes it explicit that the LLM is estimating priors from content structure, not predicting outcomes. When `performanceMetrics` is populated, UI + retro-scorer can show prior vs. observed side-by-side, which is the core evidence-loop surface.

**Prompt additions** (`analysis-extended-prompt.ts`):

- Require the model to reason about audio track features (cadence, music energy, silence) explicitly, not via transcript alone.
- Add a bigram lookup over emotional arcs for known-high-performing sequences (humor→sadness→hope; problem→hope→resolution).
- Add an authenticity-U-shape check — ask whether the ad is at polished-end or authentic-end, flag the middle as risk.
- Add a colloquiality rubric (contractions / direct address / slang / informal rhythm).

**Post-hoc analysis** (can live in `lib/video/analyze-metrics.ts` or a new scorer):

- Compute `complexityAdjustedRhythm` from per-scene `visualStyle` complexity × `cutsPerMinute`.
- Compute ECR as a logistic over (`hook.score`, `hook.timeToFirstVisualChange`, `hookDissection.stopPower`, `visual.dominantFaceRatio` in F1). Even a hand-weighted linear probe is a reasonable first cut and makes the metric debuggable.

**Retro-validation pathway (core product loop):** once `performanceMetrics.ecr` / `.nawp` / `.ctr` are ingested from ad platforms, run a periodic scorer per brand that correlates observed metrics against structural features — `emotionalArc.transitionScore`, `hookDissection.colloquialityScore`, `pacing.complexityAdjustedRhythm`, `trustSignals`, `authenticityBand`, etc. Outputs: (a) per-brand weights that recalibrate `structuralSignals.*Prior` from hand-weighted to data-anchored, (b) editor-facing "what worked for you" digest, (c) the publishable case studies that become GTM assets. This is the retrospective learning loop — structural extraction feeds it, performance ingestion fuels it, the scorer is the engine.

**Non-recommendation:** don't try to pre-train our own engagement predictor, and don't try to make Gemini output outcome predictions directly. Gemini's job is to extract research-grounded structural features consistently; the evidence comes from the retrospective join with real ad-platform data. Pre-training would need SnapUGC-scale data (~120k videos with platform attribution) we don't have, and asking an LLM to "predict" engagement from pure content re-introduces the opacity we are explicitly positioning against. DOVER-as-technical-co-signal is fine since it's measuring content quality, not claiming to predict revenue.

---

## 8. Open research questions worth monitoring

- **Platform specificity.** The VQualA work is Snapchat-Spotlight; Zhang 2025 is TikTok; Meng 2024 is TikTok; Decoding the Hook is cross-platform ads. Whether findings transfer across TikTok / Reels / Shorts is under-studied. Our `platformFit` field is correctly modelling this as a scoring dimension.
- **Cold-start for engagement prediction.** Li et al. 2024 (*Delving Deep into Engagement Prediction*) is the cleanest attack on this — they treat engagement as extractable from pixels alone, independent of user/creator. Useful upper bound on what a content-only analyzer (like ours) can achieve.
- **LLM-generated UGC performance parity.** arXiv 2512.03373 (*LLM-Generated Ads: From Personalization Parity to Persuasion Superiority*) reports 59.1% preference for AI-generated over human multimodal ads on persuasion principles. If this replicates, our analyzer should flag AI-generated/likely-AI as an explicit signal — either for native-ness scoring or as a creative-feedback surface.
- **Watch-time as sole ranking signal.** A 2025 *New Media & Society* paper (Salles, *TikTok and the missing half-second*) formalizes how watch-time-dominant ranking creates the 3-second-hook incentive. Our tier-1 weighting implicitly assumes this regime; worth re-checking if platform ranking policies shift.

---

## 9. References

### Core — build directly against these

- Meng, L., Kou, S., Duan, S., Bie, Y. (2024). *The impact of content characteristics of short-form video ads on consumer purchase behavior: Evidence from TikTok.* **Journal of Business Research**, 183. https://www.sciencedirect.com/science/article/abs/pii/S0148296324003783
- Zhang, Z., Qiu, K., Ye, Y. (2025). *Influence of audiovisual features of short video advertising on consumer engagement behaviors: Evidence from TikTok.* **Journal of Business Research**, 201. https://www.sciencedirect.com/science/article/abs/pii/S0148296325004850
- Li, D., Li, W., Lu, B., Li, H., Ma, S., Krishnan, G., Wang, J. (2024). *Delving Deep into Engagement Prediction of Short Videos.* arXiv:2410.00289. https://arxiv.org/abs/2410.00289
- Li, X. et al. (2025). *VQualA 2025 Challenge on Engagement Prediction for Short Videos: Methods and Results.* ICCV 2025 Workshop. https://openaccess.thecvf.com/content/ICCV2025W/VQualA/papers/Li_VQualA_2025_Challenge_on_Engagement_Prediction_for_Short_Videos_Methods_ICCVW_2025_paper.pdf
- Engagement Prediction of Short Videos with Large Multimodal Models (2025). arXiv:2508.02516. https://arxiv.org/abs/2508.02516
- Zhang, K., Zhang, P., Hill, S., Awadelkarim, A. (2026). *Decoding the Hook: A Multimodal LLM Framework for Analyzing the Hooking Period of Video Ads.* arXiv:2602.22299. https://arxiv.org/abs/2602.22299

### Creative-effectiveness & attention

- *The dynamic effects of visual complexity and scene cuts on viewer attention.* **Journal of the Academy of Marketing Science** (2025). https://link.springer.com/article/10.1007/s11747-025-01137-x
- Zannettou et al. (2024). *Analyzing User Engagement with TikTok's Short Format Video Recommendations using Data Donations.* **CHI 2024**. https://dl.acm.org/doi/10.1145/3613904.3642433

### Narrative persuasion & emotional flow

- *Go with the flow: Testing the effects of emotional flow on attitudinal and behavioral changes.* **Frontiers in Communication** (2025). https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2025.1553581/full
- *Narrate, Act, and Resonate to Tell a Visual Story: A Systematic Review of How Images Transport Viewers.* **Journal of Advertising** (2024). https://www.tandfonline.com/doi/full/10.1080/00913367.2024.2309921

### Video quality / technical baseline

- Wu, H. et al. (2023). *Exploring Video Quality Assessment on User Generated Contents from Aesthetic and Technical Perspectives* (DOVER). **ICCV 2023**. arXiv:2211.04894. https://arxiv.org/abs/2211.04894 · Code: https://github.com/VQAssessment/DOVER

### Emerging — monitor but don't build against yet

- *LLM-Generated Ads: From Personalization Parity to Persuasion Superiority.* arXiv:2512.03373. https://arxiv.org/abs/2512.03373
- Salles, J. (2025). *Affect and prediction in short-video social media recommendation algorithm: TikTok and the missing half-second.* **New Media & Society**. https://journals.sagepub.com/doi/10.1177/14614448251385086
