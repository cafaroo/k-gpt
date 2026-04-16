# Analysis Data Model

Reference for the JSON shape returned by `/analyze/api/analyze` and
saved to Vercel Blob per run. This is the contract between the analysis
pipeline and any downstream aggregator (e.g. cross-video dashboards,
trend analysis, CSV exports).

**Current schema version**: `2026.04-a` (see `ANALYSIS_SCHEMA_VERSION`
in `lib/video/qwen-schema.ts`).

Bump when the shape changes. Downstream tools should filter runs by
this version to avoid mixing incompatible data.

---

## Top-level keys

All mandatory unless marked `[optional]` or `[nullable]`.

| Key | Type | Notes |
|---|---|---|
| `schemaVersion` | string | Always set server-side. Never emitted by Gemini. |
| `overall` | object | 0-100 score, tagline, summary |
| `hook` | object | 0-10 score, duration, style taxonomy, elements, improvements |
| `beatMap` | array | ≥4 items canonical; hook → proof → body → cta |
| `payoffTiming` | object | `firstGlimpseAt`/`fullRevealAt` are [nullable] |
| `pacing` | object | score, cutsPerMinute, rhythm, deadSpots[], intensityCurve[] |
| `scenes` | array | Per scene: start/end/label/function/description/visualStyle |
| `onScreenText` | object | Events array + coverage stats + price sightings |
| `cta` | object | exists, type, clarity, timing, askSize, native score, microCTA |
| `audio` | object | Summary-level audio (extended fields under `extended`) |
| `visual` | object | variety, dominantColors, mood, shotTypes, movement, face ratio |
| `format` | object | primary, secondary [optional], goalAlignment |
| `niche` | object | detected, confidence, playbookCompliance[] |
| `targetAudience` | object | ageRange (always a range), interests, buyerStage |
| `ruleCompliance` | array | One entry per UNIVERSAL_RULES id, with timestamp evidence |
| `predictedMetrics` | object | Completion/engagement levels + save/comment/share 0-10 |
| `insights` | array | 6-12 observations (not recommendations); area/observation/evidence/impact |
| `extended` | object | `[optional]` — present if extended-pass succeeded |
| `extendedError` | string | `[optional]` — error from extended-pass if it failed |

## `extended` sub-shape

| Key | Type | Notes |
|---|---|---|
| `transcript` | object | language (ISO), segments[start/end/text/speaker?], fullText |
| `audioExtended` | object | voiceoverTone[], voiceoverPace, music{…}, ambientSounds[], soundEffects[], silenceMoments[], audioDensity |
| `hookDissection` | object | firstSecond{…}, firstThreeSeconds[…], curiosityGap{present/description/resolvesAt}, stopPower |
| `swipeRiskCurve` | array | One per second: {second, risk 0-10, reason} |
| `patternInterrupts` | array | Every attention-recapture moment |
| `trustSignals` | array | Every credibility cue with timestamp + strength |
| `emotionalArc` | array | Per-1-2s: {timestamp, primary emotion, intensity 0-10, note?} |
| `microMoments` | array | Chronological inventory of beats (product-reveal, proof-beat, etc.) |
| `platformFit` | object | tiktok/reels/youtubeShorts each {score, reasoning}, bestFit enum, notes |

## Score conventions

- `overall.score`: 0-100.
- All other `score` / `strength` / `intensity` / `tension` / `effectiveness` / `risk` fields: 0-10.
- `coverageRatio`, `dominantFaceRatio`, `niche.confidence`: 0-1.
- `pacing.cutsPerMinute`: integer count.
- All `time`, `start`, `end`, `timestamp`, `duration`, `resolvesAt`: seconds (float).

`normalizeScores()` (see `qwen-schema.ts`) walks the object post-hoc and
divides any 0-10 field that arrives as 0-100 by 10. Don't rely on that
downstream — trust the final shape, not the raw Gemini output.

## Enum values

All enums use kebab-case. The adapter's `coerceEnum()` helper
(`gemini-adapter.ts`) normalizes snake_case, spaces, and case drift.

Key enums:

- `hook.primaryStyle` / `secondaryStyles[]`: see `HOOK_STYLES` in `framework/taxonomy.ts`
- `beatMap[].type`: see `BEAT_TYPES`
- `scenes[].function`: `hook | problem | product-intro | social-proof | demo | benefit | cta | transition | other`
- `cta.type`: see `CTA_TYPES`
- `format.primary` / `secondary`: see `FORMATS`
- `niche.detected`: see `NICHES`
- `targetAudience.buyerStage`: `awareness | consideration | decision | retention`
- `audioExtended.music.beatSync`: `tight | loose | none | intentional-off`
- `audioExtended.audioDensity`: `sparse | moderate | dense | overwhelming`
- `audioExtended.ambientSounds[].role`: `atmosphere | realism-cue | distraction | narrative-element`
- `microMoments[].impactOnRetention`: `very-positive | positive | neutral | negative`
- `platformFit.bestFit`: `tiktok | reels | youtube-shorts | all-equal`
- `insights[].area`: `hook | pacing | visual | audio | cta | copy | editing | structure | retention`
- `insights[].impact`: `positive | neutral | negative`

## Shape guarantees

- **Every array field is always an array**, never `null` or missing —
  `ensureBaseShape()` defaults to `[]`. Safe to `.filter()` / `.map()`
  without null-checks.
- **Every enum field is always a valid value** — defaults to the first
  value in the enum set if Gemini drifts.
- **Optional fields** are `undefined` (not present), not `null`. Use `?.`
  when reading.
- **Nullable fields** (`payoffTiming.firstGlimpseAt`, `fullRevealAt`,
  `curiosityGap.resolvesAt`) are either `null` or a number.

## Metrics log

Every run emits one line to stdout (captured by Vercel Logs):

```
[analyze] metrics {"runId":"…","totalMs":92110,"completeness":0.88,"filledArrays":"22/25","totalItems":147,"emptyArrays":["extended.audioExtended.silenceMoments","hook.improvements","extended.audioExtended.drops"],"passes":[{"label":"base","ms":45120,"repaired":false,"zodIssues":3},{"label":"extended","ms":45990,"repaired":false,"zodIssues":7}],"repairPassTriggered":false,"retryCount":0}
```

- `completeness`: filled tracked arrays / total tracked arrays
- `emptyArrays`: tracked array paths that came back empty (candidates
  for prompt tuning)
- `zodIssues`: Zod issues **after** adapter + hydrate — real
  schema-mismatches, not Gemini shape drift
- `repairPassTriggered`: whether the fallback repair-pass ran (only if
  `ANALYZE_REPAIR_PASS=on`)

## Cross-run aggregation contract

Because every run produces the same shape, you can safely do things like:

```ts
const hookStyles = runs
  .filter((r) => r.schemaVersion === "2026.04-a")
  .flatMap((r) => [r.hook.primaryStyle, ...r.hook.secondaryStyles]);

const averageCompleteness =
  runs.reduce((s, r) => s + r.completeness, 0) / runs.length;

const thinAreas = runs
  .flatMap((r) => r.emptyArrays)
  .reduce<Record<string, number>>((acc, path) => {
    acc[path] = (acc[path] ?? 0) + 1;
    return acc;
  }, {});
```

When planning aggregation work, always filter by `schemaVersion` first.
