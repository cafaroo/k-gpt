# Performance ingestion architecture — video-analyzer

**Status:** Architecture draft 2 (CSV-primary)
**Scope:** How we join creatives analyzed by `video-analyzer` against observed ad-platform performance data (retention, CTR, CPA, ROAS) so structural features become evidence. The primary path is customer-exported CSV ingested through our matcher; OAuth-backed platform APIs (Meta Ads, TikTok Ads, YouTube) are a P1 convenience upgrade.
**Audience:** Contributors working on the ingestion pipeline, schema, the matcher (core IP), CSV upload flow, and — at a later phase — OAuth flows and the retro-validation scorer.

Reads with: `research-framework.md` (Section 6 — Performance overlay layer) for the why, and `market-analysis.md` (positioning around retrospective analysis) for what this unlocks commercially.

### Framing note (important)

The product is **not** an OAuth integration that happens to do creative analysis; it is an evidence layer that happens to accept data through OAuth *or* CSV. Customers already export performance data from every platform they run on — Meta Ads Manager, TikTok Ads Manager, their own BI, agency dashboards. CSV + a reliable matcher (creative asset → our `analysis_id`) is the universal path and the core IP. OAuth is a user-experience upgrade that removes the weekly export step once a brand is committed.

Treating OAuth as "the real pipeline" and CSV as "fallback" misreads the architecture. A broken Meta app review, deprecated `ads_read` scope, or revoked per-brand OAuth grant cannot take the evidence loop offline as long as the customer can still drop a CSV in. The matcher — not any single platform integration — is what must be robust.

---

## 1. Why this exists

The mission is evidence-based Creative Analysis — replacing gut-feel creative review with a retrospective learning loop. That loop requires three ingredients joined together:

1. **Structural features** — extracted from the creative by Gemini (`lib/video/prompts.ts`, `analysis-extended-prompt.ts`).
2. **Performance metrics** — retention curve, CTR, CPA, ROAS observed on the platforms the creative actually ran on.
3. **The join** — one row per creative where `structuralSignals.*` and `performanceMetrics.*` sit side-by-side and keyed by a stable `analysis_id`.

Without (2) the product is a video-describer. Without a reliable join between (1) and (2), performance data is unusable noise. The matcher that produces (3) — regardless of whether (2) arrives via CSV upload or OAuth API call — is the core IP this document is about.

---

## 2. Data sources and priorities

| Source | Priority | What we get | Surface |
|---|---|---|---|
| **CSV import (primary)** | **P0** | retention curve, ECR/NAWP components, CTR, CPM, CPA, ROAS, engagement-behaviour rates — whatever the customer exports from Meta Ads Manager, TikTok Ads Manager, their own BI, or an agency dashboard | our own upload endpoint + template library per platform |
| Meta Ads API (Facebook + Instagram, includes Reels) | P1 | same metrics as CSV, delivered continuously without a human export step | Graph API `/act_{ad_account_id}/insights` with `video_play_curve_actions`, `video_p25_watched_actions`, `action_values` |
| TikTok Ads API (TikTok for Business / Ads Manager) | P1 | same metrics as CSV, continuous | Reporting API `/report/integrated/get/` |
| YouTube Ads (via Google Ads API) | P2 | view-through rate, 25/50/75/100% quartiles, CPA | Google Ads API `video_performance_view` |
| Platform webhooks | P3 | near-real-time deltas | platform-specific |

**Principle:** every data source funnels into the same `performance_daily` rows by way of the matcher. CSV is P0 because (a) customers already perform this export weekly as part of their reporting cadence, so the marginal friction of sending it to us is near zero; (b) it removes every OAuth-related failure mode (app review timing, scope deprecation, per-brand consent flow, token refresh edge cases) from the critical path; (c) it works for every platform the customer runs on, including ones we will never build native integrations for (Snap Ads, LinkedIn, Pinterest, Apple Search Ads, internal test harnesses).

OAuth-backed pipelines are a P1 upgrade — they replace the weekly manual export with an automatic nightly sync, but they do not unlock any capability the CSV path can't deliver. Ship them when (a) CSV-primary is proven and (b) the removed-export-friction delta justifies the per-platform engineering + app-review cost.

---

## 3. Authorization and tenancy

### 3.1 CSV path (P0)

No OAuth required. The upload endpoint authenticates against the workspace session. Row-level tenancy: every row in `performance_daily` carries the uploading `workspace_id` so there is no way for one brand's CSV to land under another's `analysis_id`. The matcher (Section 4) is responsible for ensuring rows only join to `creative_links` inside the same workspace.

Audit trail on every upload: filename, uploader user, row count, match-success rate, rejected rows. A customer can always reconstruct "where did these numbers come from" because the source CSV is retained (immutable, lifecycle-policy archived at 90 days) and the per-upload match report is persistent.

### 3.2 OAuth path (P1, when enabled)

**Brand-scoped OAuth, not integrator-scoped.** Each customer brand connects their own ad accounts. Tokens are stored against their workspace, not ours.

- Compliance: Meta / TikTok ToS require the data consumer to have account-owner consent. Integrator-level access invites account-level enforcement.
- Portability: if a brand churns, their tokens revoke with them; we don't hold orphaned grants.
- Scope minimization: we request `ads_read` / `read_performance` scopes only, never `ads_management` / `write` — we read metrics, we never touch campaigns.

**Token storage.** Encrypted at rest (AES-GCM, workspace-scoped KEK). Refresh tokens only; access tokens are cached in-memory per worker run. Never log token contents; log token fingerprint (first 6 chars of SHA-256) for correlation.

**Multi-account per brand.** A single brand frequently has multiple ad accounts (e.g. Meta Ads account per region + a TikTok Ads account). Model as: `workspace → many platform_connections → each connection has many ad_accounts`. Ingestion iterates per `(platform_connection, ad_account)` pair.

**Failure handling.** OAuth outages must not take the evidence loop down. If a platform connection is revoked, scopes are deprecated, or app review lapses, the system degrades gracefully to CSV-only for that workspace. The UI surfaces the state; it does not block the customer.

---

## 4. Creative-ID linking — the matcher (core IP)

This section describes the single most important component of the system. The matcher is what turns a CSV upload or an API payload into usable evidence; everything else in this document is plumbing. If the matcher is wrong, $400k of single-ad spend lands on the wrong `analysis_id` and the scorer learns a lie. If the matcher is right, even a thin data path (e.g. a customer dropping one CSV a week) becomes research-grade evidence.

Treat matcher quality with the rigor of a payments reconciliation system, not a sync job.

### 4.1 The identifier shape

- `analysis_id` — our ID, generated at upload, primary key on the analysis row.
- `content_hash` — SHA-256 of the uploaded video bytes; stable across re-uploads.
- `platform_creative_id` — platform-assigned ID after the creative is deployed:
  - Meta: `creative_id` (ad-creative-level) and `ad_id` (ad-level). The ad-creative is the asset; the ad is the wrapper that gets impressions. We want ad-creative for structure, ad for metrics, and we need to walk `ad_id → creative_id` on the Meta side.
  - TikTok: `ad_id` carries `video_id`. Video-level metrics attach to `ad_id`.
  - YouTube (via Google Ads): `asset_resource_name` for the video asset + `ad_group_ad` for delivery.

### 4.2 Matching strategies, in order of confidence

Every incoming performance row — whether from a CSV or an OAuth-backed nightly sync — is run through the matcher which attempts these strategies in order and records which one produced the match:

1. **Explicit tag.** `platform_ad_id` was entered by the editor at upload (or added later). Confidence = 1.0. Lowest adoption in practice (editors forget); highest signal when present.
2. **Content-hash match.** When the source includes an accessible asset (e.g. OAuth sync pulling the creative from Meta, or a CSV that references a downloadable asset URL), SHA-256 the asset and compare to our `content_hash` table. Confidence = 0.98 (bytes-equal = same creative, modulo platform transcoding which we detect and tolerate via perceptual hash fallback).
3. **Filename match.** CSV row's `creative_name` or `ad_name` matches a known filename on the `analysis_id`. Confidence 0.8 base, penalized by filename generics (`Ad_01.mp4` = 0.4; `RyzeHook_Zenaida_v3.mp4` = 0.9). Fuzzy match on normalized stems.
4. **Heuristic match.** `(ad_account_id, first-seen-date ±2 days, duration ±0.5s, resolution)`. Base confidence 0.5, raised by spend-correlated-with-upload-date, capped at 0.7.

### 4.3 Confidence thresholds and human-in-the-loop

- **`confidence ≥ 0.9`:** auto-join. Logged but not surfaced for review.
- **`0.7 ≤ confidence < 0.9`:** join with `confirmed_at = null`; surface in the editor dashboard's "Confirm these matches" queue with proposed pairing + rejection path.
- **`confidence < 0.7`:** do not join. Store the candidate in an `unmatched_performance` staging table with the reasoning so a later match attempt (higher-confidence data arrives) can retroactively join and backfill. Never discard a row silently.

The queue UI is editor-facing, not admin-only: the editors are the people who know whether `Ad_RyzeBathS03_final_v7.mp4` is their work. Getting them into the confirmation loop increases confidence monotonically over time because every confirmed match strengthens priors for future heuristic attempts in the same workspace.

### 4.4 One-to-many and many-to-one

- **One analysis → many creative_ids** when the same creative runs across platforms or in multiple ad accounts. Model the join table as `analysis_id × platform × platform_creative_id`, unique on the triple. Metrics aggregate by analysis but are also stored and queryable per-platform to surface platform-specific performance differences (key editor insight: "this hook works on TikTok but not Reels").
- **Many analyses → one creative_id** is a data error (same deployed creative resolving to two of our analyses) and is surfaced as a conflict in the admin audit. Usually caused by two editors uploading the same asset with different filenames; resolved by merging the analyses.

### 4.5 Why this is IP, not plumbing

Generic SaaS ingestion systems ("push your data here, we'll store it") have a solved problem. Creative-ID mapping does not — every platform names its assets differently, every agency renames them on the way in, every editor runs their own filename convention, and the same asset can appear under three creative IDs on Meta alone (variant tests). A matcher that gets this right on 90%+ of real-world messy uploads, and gracefully queues the rest for human confirmation, is not replicated by a competitor in a weekend. It is the component of the system that must be written by someone who has seen the data.

Investment priorities: (a) confidence calibration from real Ryze data before anything else; (b) per-workspace matcher memory (if this workspace confirmed a fuzzy match last month, confidence on the same pattern goes up next month); (c) per-platform normalization (Meta's asset-library naming vs. TikTok's campaign export vs. agency-supplied CSV).

---

## 5. Metrics to ingest

Minimum viable per-creative row, mapped to `performanceMetrics` in the analysis schema:

| Field | Meta source | TikTok source | YouTube source | Notes |
|---|---|---|---|---|
| `retentionCurve[]` | `video_play_curve_actions` (per-second retention from Graph API) | `video_watched_2s` through `video_watched_6s` + completion buckets | 25/50/75/100% quartiles | Normalize to [0,1] fractions. Meta gives highest resolution. |
| `ecr` | `video_p100_watched ÷ impressions` thresholded at 5s boundary | derived from retention curve at 5s | derived | Observed. Compare against `structuralSignals.ecrPrior`. |
| `nawp` | computed from retention curve normalized over duration-bucket cohort | same | same | Requires cohort aggregation; compute at scorer time, not ingest time. |
| `completionRate` | `video_p100_watched_actions / impressions` | `video_watched_6s / impressions` for ≤6s videos; completion actions otherwise | `video_quartile_p100_rate` | Bucket by duration (<15s, 15–30s, 30–60s). |
| `ctr` | `inline_link_clicks / impressions` | `clicks / impressions` | `clicks / impressions` | Outbound-CTR preferred over all-CTR on Meta. |
| `cpm` | `spend / impressions × 1000` | same | same | Useful denominator for efficiency comparisons. |
| `cpa` | `spend / action_count` for selected conversion action | `spend / conversions` | `cost_per_conversion` | Action type stored in `conversionActionId` — different brands track different events. |
| `roas` | `purchase_value / spend` | `total_purchase_value / spend` | `conversions_value / cost` | Only populated when conversion action has a value. |
| `likes / comments / saves / shares per 1k impressions` | Graph API actions breakdown | interaction metrics | limited | Zhang-2025-behavioural-proxies. |
| `impressions` | raw | raw | raw | Always store — without it, rates are meaningless. |
| `spend` | raw | raw | raw | Needed for efficiency calcs + "is this a meaningful sample" threshold. |

### 5.1 Attribution window

Stored per row as `performanceMetrics.attributionWindow` string. Default Meta: `7d-click-1d-view`. Default TikTok: `7d-click` (TikTok doesn't surface view-through on the same footing). We do not silently normalize across windows — if a brand switches attribution setting, we keep both rows and flag them as incomparable in the scorer.

### 5.2 iOS 17+ / Advantage+ reality check

Attribution is noisier than it used to be. We mitigate by:

- Aggregating metrics at the creative-group bucket when single-ad attribution is thin (<1k impressions or flagged as modeled).
- Reporting `attributionConfidence: 'high' | 'modeled' | 'low'` derived from impression volume and whether the platform flagged the metric as modeled.
- Privileging retention-curve metrics (harder to be modeled) over downstream CPA/ROAS (often modeled) in the retro-scorer's loss function.

---

## 6. Sync strategy

Two ingestion paths run the same matcher and write the same `performance_daily` rows. The primary path is customer-initiated CSV; the optional path is OAuth nightly sync.

### 6.1 CSV path (primary)

- **Trigger:** customer uploads a CSV via the dashboard, or attaches one when standup-prepping (see Section 6 of `research-framework.md` for the standup workflow context).
- **Processing:** parse → normalize columns against the per-platform template → run matcher (Section 4) → upsert into `performance_daily` → return the match report to the uploader.
- **Latency target:** under 30s for a typical weekly export (few hundred rows); under 5min for a full historical backfill (tens of thousands of rows).
- **Template library:** one CSV template per platform export format (Meta Ads Manager "Breakdown by Video", TikTok Ads Manager "Video Insights", etc.) plus a generic "bring your own columns" mapper where the uploader points our column-picker at their BI export. Templates do the work of translating platform-specific column names into our canonical schema.
- **No scheduled component.** The customer decides cadence. Most will settle into "drop CSV during Monday standup prep" because that's when they're already looking at last week's numbers.

### 6.2 OAuth nightly batch (P1, when enabled)

- 02:00 UTC per-workspace worker run. Workspace-scoped so one noisy brand doesn't starve the others.
- For each `(platform_connection, ad_account)`, pull insights for all ads with `updated_time` in the last 7 days. The 7-day window handles platform backfills (Meta commonly revises metrics 48–72h after initial delivery).
- Upsert by `(analysis_id, platform, platform_creative_id, date)` via the same matcher pipeline as CSV.
- Expected volume at Ryze scale (weekly standup model — see Section 8): ~40–160 actively tracked creatives × 30-day lookback ≈ a few thousand ad-days per sync. Trivial for rate limits. Even if we later expand to "track every creative" mode, 55 editors × ~100 creatives/mo × 30-day lookback = ~165k ad-days per sync, still well within platform budgets.

### 6.3 Webhooks (where available)

- Meta: subscribe to `ads_insights` change notifications for near-real-time UI freshness. Not used as scorer input (scorer runs weekly off the nightly snapshot / latest CSV upload to avoid churn).
- TikTok: webhook support is limited; rely on scheduled or customer-initiated sync.

### 6.4 Rate limits to respect (OAuth path)

- Meta Graph API: per-app tier (BUC — Business Use Case rate limiting). Each ad account has its own bucket. Budget: one `/insights` call per ad account per run with paginated results; avoid per-ad calls.
- TikTok Ads API: 10 req/s per app token, 600/min per advertiser. Chunk ad IDs at 100 per report call.
- Google Ads API: points-based rate limiting; `video_performance_view` is cheap.
- Back off on 429 with jittered exponential retry; surface persistent failures in a per-workspace sync health panel.

### 6.5 Jobs queue

Use the existing job queue (the same one that runs Gemini analysis) with a new lane `performance-ingestion`. Isolates concurrency — analysis jobs shouldn't starve ingestion and vice versa. CSV uploads enqueue on submit; OAuth syncs enqueue on the scheduled trigger.

---

## 7. Schema

Postgres (Neon) is still the source of truth. Proposed tables:

```sql
-- Platform OAuth connections, one per brand per platform
platform_connections (
  id uuid pk,
  workspace_id uuid fk,
  platform text check (platform in ('meta','tiktok','youtube')),
  refresh_token_encrypted bytea,
  scopes text[],
  connected_by_user_id uuid,
  status text check (status in ('active','revoked','error')),
  last_sync_at timestamptz,
  created_at timestamptz
);

-- Ad accounts accessible via a connection
ad_accounts (
  id uuid pk,
  platform_connection_id uuid fk,
  platform_account_id text,   -- e.g. Meta act_12345
  account_name text,
  currency text,
  timezone text,
  unique (platform_connection_id, platform_account_id)
);

-- Link between our analysis and a platform creative
creative_links (
  id uuid pk,
  analysis_id uuid fk,
  ad_account_id uuid fk,
  platform text,
  platform_creative_id text,      -- Meta creative_id / TikTok video_id / YouTube asset
  platform_ad_id text,            -- Meta ad_id / TikTok ad_id
  link_source text check (link_source in ('manual','hash_match','filename_match','heuristic')),
  link_confidence numeric,        -- 0-1
  confirmed_at timestamptz,       -- null until editor confirms
  created_at timestamptz,
  unique (analysis_id, platform, platform_creative_id)
);

-- The ingested metrics themselves; one row per creative per day
performance_daily (
  id uuid pk,
  creative_link_id uuid fk,
  date date,
  impressions bigint,
  spend numeric(12,2),
  retention_curve jsonb,          -- array of {t_seconds, frac_watched}
  ecr numeric,
  completion_rate numeric,
  ctr numeric,
  cpm numeric,
  cpa numeric,
  roas numeric,
  likes_per_k numeric,
  comments_per_k numeric,
  saves_per_k numeric,
  shares_per_k numeric,
  attribution_window text,
  conversion_action_id text,
  attribution_confidence text,
  ingested_at timestamptz,
  unique (creative_link_id, date, attribution_window)
);

-- Aggregated/latest view for UI + scorer (materialized, refreshed nightly)
performance_metrics_rollup (
  analysis_id uuid pk,
  impressions_total bigint,
  spend_total numeric,
  ecr numeric,
  nawp numeric,                    -- bucket-normalized, computed at rollup
  completion_rate numeric,
  ctr numeric,
  cpa numeric,
  roas numeric,
  retention_curve_mean jsonb,      -- averaged over days weighted by impressions
  sources text[],                  -- which platforms contributed
  last_refreshed_at timestamptz
);
```

Keeping the daily-grain table (`performance_daily`) plus a rollup is deliberate: it lets the retro-scorer reason about creative decay (did this creative's retention hold up over weeks?) without reprocessing raw API payloads.

### 7.1 Graph overlay (future, not day-one)

The original POC flirted with Neo4j for pattern mining. The call there: keep everything in Postgres until we have a scorer hitting real workload ceilings. When pattern queries like "find creatives that share emotional-arc bigrams with winners in Ryze's category" become expensive in SQL, export a derived graph layer. Don't build the graph layer speculatively.

---

## 8. CSV path (primary) — detailed flow

Covered briefly in Sections 2, 3.1, and 6.1; expanded here because this is the most-used surface on day one.

### 8.1 Upload flow

1. Customer exports performance data from their platform's reporting UI (Meta Ads Manager, TikTok Ads Manager, internal BI, agency dashboard). Most DTC brands already do this weekly as part of their reporting cadence, so the marginal cost of sending it to us is near zero.
2. Customer drops the file on our upload endpoint, selects the template that matches their source (or uses the generic column-mapper for non-templated formats), optionally annotates with an attribution-window override if their platform setting differs from our default.
3. Parser normalizes rows into `performance_daily` canonical shape.
4. Matcher runs (Section 4) against the workspace's `creative_links` table.
5. Match report is returned inline: `N rows matched at confidence ≥ 0.9, M rows queued for editor confirmation, K rows unmatched with reasons`.
6. Matched rows become queryable by the scorer immediately; queued rows become queryable once confirmed.

### 8.2 Template library

One template per major platform export:

- **Meta Ads Manager** — "Breakdown by Video" export. Columns include `Ad name`, `Ad ID`, `Video plays at 25/50/75/95%`, `CTR`, `CPM`, `CPA`, `ROAS`, `Impressions`, `Amount spent`.
- **TikTok Ads Manager** — Video Insights export. Columns include `Ad name`, `Ad ID`, `Video views`, `2s/6s/complete video views`, `CTR`, `CPM`, `Conversions`.
- **Generic mapper** — customer points our column-picker at their file's columns and tells us "this column is `ad_id`, this is `spend`, this is the 3s-retention bucket." Stored per workspace so they don't re-do it every upload.

### 8.3 Source-kind tagging

Every row stores `performance_daily.source_type` in `{meta-oauth, tiktok-oauth, google-oauth, csv-meta, csv-tiktok, csv-generic, csv-bi}` so the scorer knows what it's operating on. CSV rows from internal BI are often *cleaner* than platform-API rows (the BI team has already reconciled attribution); CSV rows from agency exports are often *messier* (aggregated at a level we can't decompose). The scorer weights accordingly.

### 8.4 Why CSV is load-bearing, not a concession

Large DTC brands already run their numbers through their BI — our CSV path meets them where they are. Being the tool that ingests "your BI's truth" (or "your agency's weekly report") rather than forcing them to trust our re-pull of the platform API is a positioning asset, not a concession. In practice, it also means the evidence loop keeps running through Meta app-review delays, OAuth scope deprecations, or platform-side API outages — none of which stop a human from exporting a CSV.

---

## 9. Edge cases and known sharp corners

- **Creative variants (A/B splits).** Meta/TikTok commonly run the same asset under N creative IDs. Our join should treat all variants with matching `content_hash` as a single `analysis_id` with aggregated metrics, but surface per-variant numbers behind a drill-down for editors who want to see what changed.
- **Boosted organic posts.** Meta boosted posts get a paid `ad_id` but the underlying asset is organic. We still ingest, tagging `creative_link.source_kind = 'boosted_organic'` so the scorer can segregate.
- **Repurposed winning creatives.** When a brand rerunners an old creative in a new campaign, metrics should join to the existing `analysis_id` via `content_hash`, not create a new one. This is where the hash matcher earns its keep.
- **Non-ad uploads.** Some brands upload creatives to `video-analyzer` that never get deployed (exploratory cuts). These sit without performance data indefinitely. The UI should not imply data is "missing" — it should say "never ran as an ad," which is a different state.
- **Deleted creatives.** If a creative is deleted on the platform mid-lookback, we retain the last-known metrics and stop updating. Flag `performance_daily.platform_status = 'deleted'`.
- **Currency.** Multi-region brands may report spend in different currencies across ad accounts. Store native currency + converted USD (use platform-reported FX where available, our own FX source otherwise). Scorer operates on USD.
- **Timezone.** Platforms report on ad-account TZ; we store UTC dates + the original TZ. Daylight-saving boundaries are the most common silent bug source; test against real TZ-straddling data before shipping the scorer.
- **Retention-curve resolution mismatch.** Meta gives per-second retention up to ~60s then bucketed; TikTok gives 2s/6s thresholds + average. The scorer must handle heterogeneous curves — store the raw platform-reported shape, interpolate only at scorer time, flag curves with <5 points as low-resolution.

---

## 10. Rollout phases

Sequenced so the evidence loop is demonstrable on the cheapest possible path before any OAuth engineering happens. Each phase ends with something a design-partner editor can actually use.

**Phase 0 — schema + link table + explicit tagging (week 1–2).** Add `performanceMetrics` + `structuralSignals` to the analysis schema; create `creative_links`, `performance_daily`, `performance_metrics_rollup`; build the manual-entry creative-link UI (Editor pastes Meta `ad_id` / TikTok `ad_id` and the link persists).

**Phase 1 — CSV ingestion + matcher (week 3–5).** The critical phase. Ship:

- CSV upload endpoint with per-workspace match-report return.
- Template library for Meta Ads Manager export and TikTok Ads Manager export (covers >90% of Ryze-shaped uploads).
- Matcher implementing all four strategies from Section 4.2, with confidence thresholds and the editor-facing confirmation queue.
- Per-upload audit trail (source file retention, match report, who uploaded).

End of Phase 1 is the **first demonstrable evidence loop**: Ryze drops last week's Meta export, we match 85–95% of rows automatically, the editor confirms a handful, and the scorer (Phase 4) has real data to operate on. No OAuth required.

**Phase 2 — Retro-scorer MVP (week 6–7).** Per-brand linear probe correlating structural features against observed ECR/CPA from matched CSV data. Editor-facing "what worked for you" digest. This is the moment the evidence loop is *demonstrable to a customer* with nothing but CSV ingestion.

**Phase 3 — Meta Ads OAuth (week 8–10).** Removes the weekly CSV export step for brands who want the convenience. Reuses the same matcher and `performance_daily` rows — OAuth is an alternative transport, not a new data model. Includes app-review submission (2–4 week window overlap with implementation).

**Phase 4 — TikTok Ads OAuth (week 11–12).** Same pattern; reuse the matcher and schema. Same "convenience over CSV, not replacement" framing.

**Phase 5 — YouTube (Google Ads API), webhooks, graph overlay, generic CSV mapper polish.** Triggered by real demand, not speculatively.

**Critical-path note.** Phase 0 → Phase 1 → Phase 2 is the MVP. A competitor building the same product with OAuth-first sequencing is running a ~12-week Meta app-review dependency on their critical path; we are running a ~3-week CSV ingestion build on ours. The matcher quality we invest in during Phase 1 is the component that pays off for every subsequent phase.

---

## 11. Open questions

- **Matcher confidence calibration from real Ryze data.** The 0.9 / 0.7 thresholds in Section 4.3 are priors. First month of real uploads is where we learn whether filename-match confidence of 0.8 is too optimistic, too conservative, or workspace-dependent. Instrument and review.
- **Editor UX for the match-confirmation queue.** Match confirmation is an editor-facing workflow, not an admin task. Needs to be fast enough to clear a week of queued matches in a few minutes during standup prep; slow UX here breaks adoption of the whole evidence loop.
- **Meta Marketing API access level (Phase 3).** Standard tier requires app review before production use with non-Meta-business accounts. Schedule the app review submission early in Phase 3 — approval window is commonly 2–4 weeks — but the business does not block on it because CSV covers this brand's Meta data from Phase 1.
- **Per-brand retention curve resolution.** Do we need sub-second granularity or is 1s sufficient for the scorer? 1s is what the research framework operates at, but tier-1 hook work (Decoding the Hook, 2026) uses sub-second. Start at 1s; revisit if hook-scorer error bars demand finer. CSV exports vary on what resolution they carry; normalize at ingestion.
- **Historical backfill depth.** How far back on initial onboarding? 90 days covers most brands' "recent winners" dataset; 180 days gives better seasonality; 365 days is expensive and rarely changes the scorer's output. Default to 90, make it configurable. CSV can go back further than most OAuth paths (Meta's `insights` endpoint truncates older data).
- **Attribution model unification.** Do we re-run every metric under a canonical attribution window (e.g. `7d-click`) or respect each brand's configured window? Default to respecting; add unified view as a scorer-time option so cross-brand benchmarking stays honest.
- **Scorer cadence.** Weekly per brand is probably right; more-frequent runs introduce noise-driven pattern drift. Confirm against first month of real Ryze data. Weekly also aligns with the standup workflow (see `research-framework.md` §6 and `market-analysis.md` §4).

---

## 12. What this doc deliberately does not specify

- **The scorer's exact regression form.** Linear probe is the MVP; whether we graduate to ridge / per-feature bootstrapping / Bayesian shrinkage depends on dataset size and observed variance. Design the scorer as a swappable module behind a stable interface.
- **The UI for prior-vs-observed comparison.** Product/UX decision, not an architectural one. Constraint from Section 6.5 of `research-framework.md`: keep structural and performance sides visually separate.
- **Paid-vs-organic cross-platform weighting.** We ingest what we can; the scorer can reason about platform mix. Don't try to engineer around different platforms' different biases at ingestion time — it'll be wrong, and the scorer is the right place for it.
