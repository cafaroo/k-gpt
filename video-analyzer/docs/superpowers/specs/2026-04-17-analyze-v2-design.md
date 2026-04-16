# `/analyze/v2` — Research-grounded UGC Analysis Platform (POC)

**Status:** Design · Draft 1
**Date:** 2026-04-17
**Author:** Cafaroo (via Claude Code brainstorming)
**Parent docs:**
- `docs/research-framework.md` — peer-reviewed framework we're implementing against.
- `docs/analysis-data-model.md` — v1 contract (will be extended, not replaced).

---

## 1. Context

The v1 `/analyze` pipeline works and produces rich per-video analysis, but:

- It has no cross-run aggregation surface. Every analysis lives in a Blob JSON file; we can't query "all videos where ECR > 0.6 AND authenticity = moderate".
- The schema is grounded in folklore + our own framework, not the published research in `research-framework.md` — missing fields include colloquiality score, authenticity U-shape, ECR/NAWP prediction, emotional-flow bigram match, complexity-adjusted rhythm, voiceover cadence.
- The UI is per-video only; the user's stated goal is a POC for a 2026 UGC analysis platform with upload → extraction → cross-video dashboard → per-video drill-in, with a future fourth step for real performance data + "why-did-it-perform" explanation.

`/analyze/v2` is a **parallel** route that keeps v1 untouched (no migration risk), implements the full research framework, adds Postgres-backed aggregation, and ships a polished dashboard. When v2 matures, v1 gets retired.

The POC scope is everything through step 3 (per-video drill-in from dashboard). Step 4 (real performance data + explainer) is reserved in the data model but not built.

---

## 2. Architecture

```
┌─ UPLOAD ────────────────────────────────────┐
│ /analyze/v2 — drop-zone, single + batch     │
│  upload → Blob → videos-row                 │
│  POST /analyze/v2/api/jobs → 202 + jobId    │
└─────────────────────────────────────────────┘
              ↓ jobId
┌─ EXTRACTION (after(), Fluid Compute) ──────┐
│ lib/video/v2/analyze-worker-v2.ts           │
│  1. Fetch video from Blob                   │
│  2. Gemini base pass (V2-prompt)            │
│  3. Gemini extended pass (V2-prompt)        │
│  4. Post-hoc scorers (ECR, NAWP,            │
│     emotional bigram, complexity-rhythm)    │
│  5. Persist: Blob (raw + hydrated JSON)     │
│             + Postgres (hot fields + jsonb) │
└─────────────────────────────────────────────┘
              ↓
┌─ DASHBOARD ─────────────────────────────────┐
│ /analyze/v2/dashboard → Postgres SELECT     │
│ /analyze/v2/video/[id] → Postgres + Blob    │
└─────────────────────────────────────────────┘
```

**Reuse from v1:**
- `analyze-metrics.ts`, `schema-to-skeleton.ts`, `gemini-adapter.ts` (enum coercers), `analyze-repair.ts`, retry/timeout wrapper, JSON parse cascade — all imported as-is.
- Dashboard cards (`PacingCurve`, `EmotionalArcChart`, `SwipeRiskCurve`, `HookDissectionCard`, `AudioInsightsV2`, `TrustSignalsCard`, `MicroMomentsCard`, `PlatformFitCard`) — reused in v2 per-video view.
- `QwenAnalysisSchema` + `AnalysisExtendedSchema` — extended via `.extend({...})`, not duplicated.

**New code:**
- `app/analyze/v2/*` — routes, pages, layout.
- `lib/video/v2/analysis-v2-schema.ts` — research-field extensions.
- `lib/video/v2/analysis-v2-prompts.ts` — base + extended prompts with colloquiality/authenticity/flow rubrics.
- `lib/video/v2/analyze-worker-v2.ts` — pipeline orchestrator.
- `lib/video/v2/scorers.ts` — ECR, NAWP, bigram, complexity-rhythm.
- `lib/db/schema.ts` — extend existing file with `video`, `analysis`, `batch` tables (existing exports: `user`, `chat`, `message`, etc. — follow that naming convention, singular PascalCase table names).
- `lib/db/queries.ts` — extend with aggregation queries.
- `components/video/v2/*` — new cards (ECR gauge, authenticity band, emotional-flow diagram), research-first hero row.

---

## 3. Data model

### 3.1 Postgres (drizzle)

Hybrid normalized + jsonb. Hot fields (filterable) in columns, detail structures in jsonb.

```sql
-- Naming follows existing lib/db/schema.ts convention: singular PascalCase
-- table names (e.g. "Video" not "videos"), camelCase column names in
-- drizzle, snake_case in actual SQL (via drizzle's ().notNull() helpers).

-- Video: one row per uploaded video
Video
├─ id                uuid PK
├─ userId            uuid  FK → "User".id
├─ blob_url          text  (Vercel Blob URL)
├─ filename          text
├─ file_size_bytes   bigint
├─ duration_sec      numeric
├─ width, height     integer
├─ aspect_ratio      text  -- "9:16" | "1:1" | ...
├─ batch_id          uuid nullable
├─ user_tags         text[]
├─ uploaded_at       timestamptz
└─ thumbnail_url     text nullable  (populated post-analysis)

-- Analysis: one row per completed analysis run
Analysis
├─ id                          uuid PK
├─ videoId                     uuid FK → "Video".id
├─ userId                      uuid FK → "User".id  (denormalized for fast per-user filters)
├─ schema_version              text default '2026.04-v2'
├─ status                      text  -- 'pending' | 'done' | 'error'
├─ analysis_blob_url           text nullable
├─ raw_base_blob_url           text nullable
├─ raw_extended_blob_url       text nullable
├─ created_at                  timestamptz
├─ completed_at                timestamptz nullable
├─ latency_ms                  integer nullable
├─ completeness_score          numeric nullable
├─ zod_issue_count             integer nullable
├─ error_message               text nullable
│
│  -- HOT FIELDS (queryable for aggregation) --
├─ overall_score               integer  -- 0-100
├─ hook_score                  numeric  -- 0-10
├─ hook_duration               numeric
├─ stop_power                  numeric
├─ hook_colloquiality          numeric  -- 0-10, first-3s
├─ pacing_score                numeric
├─ cuts_per_minute             numeric
├─ complexity_adjusted_rhythm  numeric
├─ voiceover_cadence           numeric  -- syllables/sec
├─ emotional_transition_score  numeric  -- 0-10
├─ colloquiality_score         numeric  -- 0-10, video-level
├─ authenticity_band           text     -- 'low' | 'moderate' | 'high'
├─ brand_heritage_salience     text     -- 'absent' | 'moderate' | 'high'
├─ ecr                         numeric(4,3)  -- 0-1
├─ nawp                        numeric(4,3)  -- 0-1
├─ cta_clarity                 numeric
├─ payoff_is_early             boolean
├─ niche                       text
├─ format_primary              text
├─ platform_best_fit           text
│
│  -- JSONB COLUMNS (indexable but not flat-queryable) --
├─ insights                    jsonb
├─ beat_map                    jsonb
├─ scenes                      jsonb
├─ rule_compliance             jsonb
└─ research_meta               jsonb  -- scorer rationales, bigram matches

-- Batch: grouping for batch upload
Batch
├─ id            uuid PK
├─ userId        uuid FK → "User".id
├─ name          text
├─ createdAt     timestamptz
```

Indexes: `Analysis(videoId)`, `Analysis(userId, createdAt desc)`, `Analysis(ecr)`, `Analysis(authenticityBand)`, `Video(batchId)`.

### 3.2 Extended zod schema

```ts
// lib/video/v2/analysis-v2-schema.ts
import { QwenAnalysisSchema, score10 } from "../qwen-schema";
import { AnalysisExtendedSchema } from "../analysis-extended-schema";

export const ANALYSIS_V2_SCHEMA_VERSION = "2026.04-v2";

export const QwenAnalysisV2Schema = QwenAnalysisSchema.extend({
  schemaVersion: z.string().default(ANALYSIS_V2_SCHEMA_VERSION),
  pacing: QwenAnalysisSchema.shape.pacing.extend({
    sceneComplexity: z.array(
      z.object({ start: z.number(), complexity: score10 })
    ),
    complexityAdjustedRhythm: z.number(),
  }),
  predictedMetrics: QwenAnalysisSchema.shape.predictedMetrics.extend({
    ecr: z.number(),
    nawp: z.number(),
    ecrRationale: z.string(),
    nawpRationale: z.string(),
  }),
});

export const AnalysisExtendedV2Schema = AnalysisExtendedSchema.extend({
  colloquialityScore: score10,
  authenticityBand: z.enum(["low", "moderate", "high"]),
  brandHeritageSalience: z.enum(["absent", "moderate", "high"]),
  audioExtended: AnalysisExtendedSchema.shape.audioExtended.extend({
    voiceoverCadence: z.number(),
  }),
  hookDissection: AnalysisExtendedSchema.shape.hookDissection.extend({
    colloquialityScore: score10,
  }),
  emotionalArc: z.array(
    AnalysisExtendedSchema.shape.emotionalArc.element.extend({
      transitionFromPrevious: z
        .enum(["smooth", "hard-cut", "escalation", "release"])
        .optional(),
    })
  ),
  emotionalFlowSequence: z.array(z.string()),
  emotionalFlowMatchScore: score10,
});

export type QwenAnalysisV2 = z.infer<typeof QwenAnalysisV2Schema>;
export type AnalysisExtendedV2 = z.infer<typeof AnalysisExtendedV2Schema>;
```

### 3.3 Post-hoc scorers

`lib/video/v2/scorers.ts` — deterministic, no Gemini calls:

- `computeEcr(base, extended)` → 0-1. Logistic probe over `hook.score`, `hook.timeToFirstVisualChange` (inverted), `hookDissection.stopPower`, `visual.dominantFaceRatio`, `hookDissection.colloquialityScore`. Hand-weighted initially; validated once real ECR data arrives.
- `computeNawp(base, extended)` → 0-1. Baseline per duration bucket (`<15s | 15-30s | 30-60s`) adjusted by `payoffTiming.isEarly`, `pacing.score`, `emotionalFlowMatchScore`.
- `matchEmotionalBigram(emotionalArc)` → `{ sequence: string[], matchScore: 0-10 }`. Bigram/trigram match over known high-performing patterns (`humor→sadness→hope`, `problem→hope→resolution`, `curiosity→reveal→validation`).
- `computeComplexityAdjustedRhythm(scenes, cutsPerMinute)` → `cutsPerMinute / meanSceneComplexity` clamped to 0-100.

Each scorer also emits a one-sentence rationale string for display in UI.

---

## 4. API routes

```
POST /analyze/v2/api/uploads
  Multipart. Stores in Blob, inserts videos-row. Returns { videoId, blobUrl }.

POST /analyze/v2/api/jobs
  Body: { videoId }
  Creates analyses-row (status=pending), schedules worker via after().
  Returns 202 { jobId: analysis.id }.

GET  /analyze/v2/api/jobs/[id]
  Polling. Returns Postgres row trimmed to { status, completeness, latencyMs, errorMessage }.

GET  /analyze/v2/api/analyses
  Query params: filter expressions (ecr_gte, authenticity_eq, niche_in, ...), sort, limit, offset.
  Auth: every query is scoped to the authenticated user (WHERE user_id = session.user.id).
  Returns paginated rows with hot fields + thumbnail_url (no jsonb).

GET  /analyze/v2/api/analyses/[id]
  Auth: 404s if the analysis doesn't belong to the authenticated user.
  Returns merged payload: Postgres row + jsonb cols + fetched Blob JSON (for curves).

POST /analyze/v2/api/batches
  Body: { name }. Returns { batchId }.

POST /analyze/v2/api/batches/[id]/uploads
  Bulk variant of /uploads. Parallel-uploads up to 3 concurrent, queues rest.
```

### Worker pipeline (`analyze-worker-v2.ts`)

```
1. Fetch video from Blob (reuse v1 logic).
2. Call Gemini base pass with QWEN_V2_SYSTEM_PROMPT.
   Retry + timeout + parse cascade (reused from v1).
3. Call Gemini extended pass with EXTENDED_V2_SYSTEM_PROMPT.
   Parallel to base. Same retry + parse cascade.
4. Adapt → hydrate → Zod-validate against V2 schemas.
   (Adapter reused from v1; new fields fall through to defaults if Gemini skipped.)
5. Post-hoc scorers populate ecr, nawp, emotionalFlowMatchScore,
   complexityAdjustedRhythm + their rationales.
6. Persist:
   a. Upload hydrated JSON to Blob → analysis_blob_url.
   b. Upload raw base + extended rawText to Blob (debug).
   c. UPDATE analyses SET hot_fields + jsonb_cols + status='done'.
7. Emit metrics log (v1 logger, extended with ecr/nawp/completeness).
```

Errors at any stage → UPDATE analyses SET status='error', error_message=..., then return. Polling surfaces it to client.

---

## 5. UI and user flow

### 5.1 Upload (`/analyze/v2`)

- Drop-zone, single/batch toggle, accepted: MP4/MOV/WebM, ≤200 MB each.
- Queue card below the zone shows per-file progress (uploading → analyzing → done).
- `useUploadQueue` hook manages parallel uploads (max 3 concurrent), polls jobs.
- First completion auto-navigates to `/analyze/v2/dashboard`.

### 5.2 Dashboard (`/analyze/v2/dashboard`)

- 4-stat KPI row: video count, median ECR, count in moderate-authenticity-zone, avg colloquiality.
- Filter bar: ECR band, authenticity, niche, platform, hook style. All filters map to Postgres WHERE.
- Charts grid (Recharts): ECR histogram, colloquiality×ECR scatter, authenticity U-shape bars, top emotional-flow bar.
- Videos table: thumbnail, filename, ECR, NAWP, colloquiality, authenticity, date. Sortable, paginated.
- Row click → `/analyze/v2/video/[id]`.

### 5.3 Per-video (`/analyze/v2/video/[id]`)

- Hero: video player (40%) + summary (60%).
- Research-first row: 4 gauge cards — ECR, NAWP, colloquiality, authenticity band.
- Emotional flow visualization: sequence of detected emotions with pattern-match indicator.
- Tier 1 (0-3s): `HookDissectionCard` (v1) + colloquiality score for the hook.
- Tier 2 (3s → end): `PacingCurve` (complexity-annotated), `SwipeRiskCurve`, `EmotionalArcChart`, `PatternInterruptsCard`, `AudioInsightsV2` (+ cadence).
- Tier 3 (outcome): `TrustSignalsCard`, `MicroMomentsCard`, `PlatformFitCard`, CTA summary, brand heritage, payoff timing.
- Reserved section for future performance data.

### 5.4 Design system

- shadcn/ui + Tailwind v4. New cards follow existing `<Card>` pattern.
- Gauges (ECR, NAWP) as small SVG components — not Recharts.
- Dark mode default. Subtle gradients on score gauges. Mikro-animations on card entry via Framer Motion.
- Typography: Inter for data, monospace for timestamps.
- Progressive reveal: Tier 1 from Postgres hot fields, Tier 2/3 hydreras via Blob fetch under skeleton.

---

## 6. Testing

**Unit (Vitest):**
- `scorers.ts` — known inputs → expected outputs. Edge cases: zero cuts, missing curves, all-identical emotion arc.
- V2 schema coercion: enum drift, timestamp normalization.
- Completeness calculation on V2 schema.

**Integration:**
- Worker flow with mocked Gemini → assert Postgres row shape + Blob payload.
- Polling endpoint: pending → done transition under 2 minutes.
- Repair-pass activation: artificially low completeness triggers repair.

**E2E (Playwright):**
- Single upload → dashboard row within 2 min → click → per-video renders.
- Batch (3 videos) → all complete → dashboard shows 3 rows.
- Filter `ECR > 0.5` → rows match.

Fixtures from `.analyze-runs/` become scorer snapshot tests — any change in output is flagged.

---

## 7. Deployment and rollout

1. **Provision Postgres** via Vercel Marketplace (Neon). Injects `DATABASE_URL`.
2. **drizzle migrations**: `drizzle-kit generate` → `lib/db/migrations/*.sql`, apply on staging then production.
3. **Feature flag** `ANALYZE_V2_ENABLED=on`. When off, `app/analyze/v2/layout.tsx` reads the env var and redirects to `/analyze` via `next/navigation redirect()`. No middleware needed.
4. **Staging run** with 5-10 test videos. Validate: Postgres rows match Blob JSON, completeness > 0.8, dashboard renders, no NaN scorer output.
5. **Production rollout** after signoff. v1 runs in parallel ≥2 weeks. Metrics log monitored for zodIssueCount + completeness per run.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Expanded prompt → Gemini drift / incomplete output | Auto-enable `ANALYZE_REPAIR_PASS=on` in v2 worker. Completeness threshold 0.5. |
| ECR logistic probe is hand-tuned, no ground truth | UI labels `ecr` as *ECR estimate*. Rationale text explains inputs. Validated in step 4 when perf data arrives. |
| Postgres schema churns during POC | `schema_version` on every row. Incremental drizzle-migrations. Queries filter by version. |
| Blob write cost doubles (raw + hydrated) | gzip JSON before put. Dev-runs stay in `.analyze-runs/`. |
| Batch >10 videos → Vercel Function limits | Worker processes max 5 parallel; extras queue. |
| No real perf data yet → step 4 speculative | Explicit out of scope for POC. Only data-model slot reserved. |

---

## 9. Success criteria (POC exit)

1. Uploaded video produces Postgres row + Blob JSON, visible on dashboard ≤2 min.
2. Dashboard filters (ECR, authenticity) return correct subsets across 10+ videos.
3. Per-video page shows all v1 cards + research-first metrics.
4. Zod issues on hydrated payload < 5 per run (95th percentile).
5. Completeness score mean > 0.85 over 10 test runs.
6. UI feels polished enough to demo externally (dark mode, gauges, smooth nav).

---

## 10. Out of scope (this POC)

- Step 4: real performance data ingest + post-hoc "why-did-it-perform" explainer.
- Cross-user team view (single-user POC).
- CSV/JSON export endpoints.
- DOVER technical-quality co-signal (from research doc §5).
- Migration of existing v1 `.analyze-runs/` into v2 Postgres.
- Model choice UI (stays on current `google/gemini-3-flash`).

Each of these gets its own follow-up spec when the POC validates.
