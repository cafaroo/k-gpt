# BRAND RETRO DNA — Hypothesis Engine · Design Spec

*Author: Gustaf + Claude · Drafted: 2026-04-18 · Status: iteration-1 (awaiting review)*

> *"You and I can do anything, Claude — trust yourself."*

## 1 · Purpose

Build a **multi-tenant, graph-first, chat-driven retrospective analysis platform** that lets three personas — Growth Manager, Editor, Executive — explore the creative DNA of their brand's ad portfolio and validate hypotheses about what drives performance.

The platform extends `video-analyzer` (the POC whose canonical creative schema is already in production — formerly "v2", promoted to canonical in M0; see §14). It adds:

- A tenant-scoped property graph of creatives ↔ attributes ↔ performance ↔ time
- An LLM-driven chat that operates the graph via a constrained tool catalog
- A spatial, shader-rendered canvas where insights *bubble up visually* (not as prose)
- Just-in-time data ingestion via chat ("I'm missing X on these 8 creatives — want to add it?")

**Scope rule:** retrospective analysis only (why did X perform the way it did). Predictive scoring lives inside `video-analyzer` as AI-tagged features on the creative node; no platform-level forecasting model.

---

## 2 · Problem framing

### What we have
- `video-analyzer` produces a **canonical, rich creative analysis** per uploaded UGC video (≈130 features: hook archetype, claim type, script angle, narrative style, cuts/min, eye-contact, sentiment, etc.). Schema is fixed across tenants.
- A Postgres schema with hot fields + jsonb blobs, already RLS-ready.

### What we lack
- **Heterogeneous performance data.** Every customer brings a different source (Northbeam, Meta Ads, TikTok, Shopify, GA4, Klaviyo, custom CSV). Schemas, metric definitions (ROAS vs MER vs nROAS vs iROAS), hierarchies (campaign → adset → ad vs flat), and naming conventions all vary.
- **A substrate for research.** Today, cross-dimensional questions like *"which attribute combinations drive ROAS in Q1 2025 but not Q1 2026?"* require bespoke SQL per tenant.
- **A differentiated UX.** Chart.js + filter-pills is table-stakes. Customers need a tool that *feels* new — not another dashboard.

### What we will build
Three architectural layers + three persona-specific surfaces, all sharing one graph-state.

---

## 3 · Architecture overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         SURFACES (tenant UI)                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Growth Manager │  │ Creative       │  │ Report Builder │         │
│  │ Hypothesis     │  │ Inspector      │  │ (Executive)    │         │
│  │ Studio         │  │ (Editor)       │  │                │         │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘         │
│           │                   │                   │                   │
│  ┌────────┴───────────────────┴───────────────────┴───────┐         │
│  │             GraphView canvas (single source of truth)    │         │
│  │   react-three-fiber + custom GLSL + orthographic 2.5D    │         │
│  └────────┬───────────────────────────────────┬───────────┘         │
│           │                                   │                       │
│     MANUAL PARAMS                      CHAT (LLM + tools)            │
│     (GUI over tool API)                (parser → tool calls)         │
└───────────┬───────────────────────────────────┬─────────────────────┘
            │                                   │
            └──────────────┬────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  ANALYSIS PRIMITIVE LIBRARY                           │
│  cohortDiff · recipeDiscovery · attributeShift ·                     │
│  similarCreatives · hypothesisTest · assessCoverage · ...            │
└──────────────────────────┬───────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│           CANONICAL GRAPH (Apache AGE on Postgres)                    │
│                                                                       │
│  PRIVATE LAYER (tenant-scoped, RLS enforced — build first)           │
│  Creative · Attribute · Performance · TimePeriod · Campaign          │
│                                                                       │
│  PUBLIC LAYER (shared ontology, anonymised benchmarks — build later) │
│  AttributeType · Benchmark · ResearchCitation                        │
└──────────────────────────┬───────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│             INGESTION (per-source adapters)                           │
│  video-analyzer output · Northbeam CSV · Meta Ads API ·             │
│  Shopify sync · generic CSV · LLM-assisted paste                     │
└──────────────────────────────────────────────────────────────────────┘
```

**Key architectural decision: one graph, two write-paths.**
Both the manual parameter-chooser and the LLM chat mutate the *same* `GraphState` via the *same* tool API. The manual UI is a GUI skin over the tool catalog. This gives us unified undo/redo and a single debuggable state machine.

---

## 4 · Canonical graph schema

### Node types (all `tenant_id`-scoped)

**`Creative`** — one per analysed video
```
{
  id: UUID,
  tenant_id: UUID,
  video_id: UUID (FK to postgres video row),
  filename: string,
  thumbnail_url: string,
  duration_sec: float,
  ingested_at: timestamptz,
  completeness: jsonb,   -- { claim_type: 1.0, ecr: 0.6, ... } per attribute
  -- numeric scores as properties (no graph node needed):
  overall_score: float,
  hook_score: float,
  cuts_per_minute: float,
  ecr_pred: float,
  ...
}
```

**`Attribute`** — polymorphic by `type` field, shared across creatives within tenant
```
{
  id: UUID,
  tenant_id: UUID,
  type: enum,          -- 'hook_archetype' | 'claim_type' | 'theme' |
                       --  'script_angle' | 'narrative_style' | 'creator' |
                       --  'ugc_subtype' | 'authenticity_band' | ...
  value: string,       -- 'curiosity-gap', 'medical', 'mushroom', 'Silver Wells'
  display_label: string,
  occurrences: int     -- denormalised count for fast sizing
}
```

Two creatives with the same `(type, value)` point to the **same** Attribute node. This is the research substrate — cohort traversals, co-occurrence stats, shared-attribute similarity all fall out of this structure.

**`Performance`** — one per ad-row joined to a creative
```
{
  id: UUID,
  tenant_id: UUID,
  source: enum,              -- 'northbeam' | 'meta' | 'tiktok' | 'shopify' | 'csv'
  source_row_id: string,     -- original external ID
  spend: float,
  orders: float,
  visits: float,
  aov: float,
  metrics: jsonb             -- flexible key/value for non-canonical metrics
                             --   per-source (e.g., nroas_x100, custom cohort rates)
}
```

Canonical metrics (`spend`, `orders`, `roas_new`, `cpo`, `ecr`, `aov`) are top-level columns for fast querying. Everything else lives in `metrics` jsonb — per-tenant flexibility without schema migration.

**`TimePeriod`** — discrete bucket (phase / month / week / custom)
```
{
  id: UUID,
  tenant_id: UUID,
  label: string,             -- 'P32', '2025-Q1', 'BF-2025-week-47'
  start_ts: timestamptz,
  end_ts: timestamptz,
  kind: enum                 -- 'phase' | 'month' | 'week' | 'quarter' | 'custom'
}
```

**`Campaign`** — optional hierarchy node for tenants whose data has campaign structure
```
{ id, tenant_id, name, platform, start_ts, end_ts, parent_id? }
```

### Edge types

| Edge | From → To | Properties |
|---|---|---|
| `HAS_ATTRIBUTE` | `Creative → Attribute` | `role` (which schema field), `position?`, `strength?` |
| `MEASURED_BY` | `Creative → Performance` | `ad_name`, `adset_name`, `platform` |
| `IN_PERIOD` | `Performance → TimePeriod` | — |
| `IN_CAMPAIGN` | `Performance → Campaign` | — |
| `PARENT_OF` | `Campaign → Campaign` | hierarchy |
| `VARIANT_OF` | `Creative → Creative` | for re-edits / versions |

### Completeness tracking

Each `Creative.completeness` is a jsonb map from attribute-type to a 0–1 score reflecting how confident we are about that field. A score of `0.0` means "we don't have this data at all." This is what `assessCoverageForQuery` uses to detect ingestion gaps.

### RLS policy

Every node table has `tenant_id NOT NULL`. Postgres RLS enforces:
```sql
CREATE POLICY tenant_isolation ON creatives
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```
AGE queries run through Postgres, so RLS composes automatically — Cypher traversals cannot cross tenant boundaries.

### Public layer (future, not in MVP)

When we have ≥5 tenants, we extract a **shared ontology** + **anonymised benchmarks**:
- `AttributeType` — the concept "hook_archetype exists and has these canonical values"
- `Benchmark` — aggregated stats like *"avg ROAS for medical-claim creatives in wellness vertical: 0.28 ± 0.04"* with k-anonymity ≥ 5
- `ResearchCitation` — Zhang 2025, Meng 2024, etc., linkable to attribute types

Private-layer attribute values never leak. Only values that appear in ≥k tenants become public.

---

## 5 · Graph state (TypeScript)

The canvas + chat + manual-params all read/write this one object:

```typescript
type MetricKey = 'roas' | 'cpo' | 'ecr' | 'aov' | 'orders' | 'nroas' | string;

type Filter =
  | { id: string; type: 'period'; periodIds: string[] }
  | { id: string; type: 'attribute'; attrId: string; value?: string; op: 'include' | 'exclude' }
  | { id: string; type: 'cohort'; metric: MetricKey; tier: 'top-quartile' | 'top-decile' | 'bottom-quartile' | { threshold: number } }
  | { id: string; type: 'textSearch'; query: string }
  | { id: string; type: 'creativeIds'; ids: string[] };

type Split = {
  axis: 'period' | 'attribute';
  buckets: string[];        -- e.g., ['2025-Q1', '2025-Q2']
  side: 'side-by-side' | 'overlay';
};

type LassoSelection = {
  id: string;
  creativeIds: string[];     -- resolved from spatial selection
  stats: LassoStats | null;  -- lazily computed
};

type LassoStats = {
  inCount: number;
  outCount: number;
  attributeDeltas: Array<{ attrId: string; inPct: number; outPct: number; lift: number }>;
  metricMeans: Record<MetricKey, { in: number; out: number; deltaPct: number }>;
  tests: Array<{ label: string; p: number; effectSize: number; method: string }>;
};

type PinnedInsight = {
  id: string;
  title: string;
  filterSnapshot: Filter[];
  lassoSnapshot?: LassoSelection;
  notes?: string;
  chartSpec?: any;
  created_at: string;
};

interface GraphState {
  tenantId: string;
  metric: MetricKey;
  filters: Filter[];
  split: Split | null;
  lassos: LassoSelection[];
  pinnedInsights: PinnedInsight[];
  timeRange: { start: string; end: string };
  focusedNodeId: string | null;
  // Derived (cached):
  visibleCreativeIds: string[];
  visibleAttributeIds: string[];
}
```

State mutations flow through a reducer. Every mutation produces an undoable action (except non-semantic camera moves).

---

## 6 · Tool catalog

Tools are the **only** way to mutate the graph. Both the manual UI and the LLM chat call them.

### 6.1 Read tools (query, no state mutation)

| Tool | Returns | Purpose |
|---|---|---|
| `describeCurrentView()` | summary object | Tell LLM / user what's currently shown |
| `listAttributeTypes()` | `AttributeType[]` | What dimensions exist for this tenant |
| `getTopAttributes(metric, n)` | ranked list with effect-size | Pre-rank dimensions by ROAS impact |
| `getCohortStats(selector)` | `LassoStats` | %-fit + lift for any selection |
| `hypothesisTest(groupA, groupB, metric)` | `{p, effectSize, method, n}` | Fisher / t / Mann-Whitney as appropriate |
| `searchCreatives(query)` | `Creative[]` | Semantic/textual lookup |
| `getAttributeCorrelations(metric)` | `{attr, rho, p}[]` | Spearman ρ list |
| `getCreativeNeighbors(id, k)` | `Creative[]` | k-nearest in attribute-space |

### 6.2 Write tools (state mutation, visible in canvas)

| Tool | Effect |
|---|---|
| `setMetric(key)` | Changes active metric, reshapes glow/colours |
| `addFilter(spec)` | Prepends filter; visible nodes recompute |
| `removeFilter(id)` | Removes filter |
| `splitView(axis, buckets)` | Enters side-by-side comparative mode |
| `exitSplit()` | Returns to single canvas |
| `createLasso(selector)` | Programmatic lasso (e.g., "all creatives with claim=medical") |
| `clearLasso(id)` | Releases a lasso |
| `pinInsight(title)` | Saves current state+lasso as reusable block |
| `unpinInsight(id)` | Removes from pin list |
| `focusOn(nodeId)` | Camera pans to a node, dims others |
| `excludeNodes(selector)` | Adds exclusion filter |
| `resetView()` | Clear all filters, lassos, splits |
| `setTimeRange(start, end)` | Mutates the time-scrubber position |

### 6.3 Ingestion tools (just-in-time data collaboration)

| Tool | Effect |
|---|---|
| `assessCoverageForQuery(query)` | Returns `{ covered, missing, impactEstimate }` — what's needed for confident answer |
| `requestDataFromUser(missingSpec, uiHint)` | Opens CSV uploader / paste dialog / API-connector wizard in right panel |
| `ingestPayload(payload, format)` | Normalises + upserts; supports CSV, JSON, pasted tables, screenshots via multimodal |
| `proceedWithGap(query, uncertaintyLevel)` | User opt-in: answer despite gaps; sets uncertainty flag in output |
| `listIngestionSources()` | Which adapters are available / configured for this tenant |

**System-prompt rule for chat LLM:** *"Before executing a query that produces a headline answer, call `assessCoverageForQuery`. If the missing data would change the answer by >15% or confidence interval by >20%, surface the gap to the user with an impact estimate before proceeding."*

---

## 7 · DSL (constrained grammar, LLM → tools)

The chat LLM does **not** free-form NLU. It translates user utterances into a constrained DSL that maps 1:1 to tool calls. This makes behaviour auditable and disambiguation possible.

```
// Grammar sketch
operation := filter | split | lasso | pin | metric | test | suggest | reset
filter    := "filter" filter-spec
filter-spec := period-spec | attribute-spec | cohort-spec | text-spec
period-spec := "period=" (preset | "start:" date "end:" date)
preset    := "Q1-2025" | "Q2-2025" | "last-30d" | phase-id
cohort-spec := "cohort=top|bottom" "-quartile|decile|N%"
split     := "split" axis "=" bucket-list
metric    := "metric=" (roas | cpo | ecr | aov | orders | ...)
test      := "test" (cohort-A "vs" cohort-B) "on" metric
suggest   := "suggest" "attrs|pairs|recipes" "for" metric
```

**Ambiguity handling:** if the LLM parser is unsure (e.g., "winners" → top 25% or top 10%?), it must emit a **disambiguation card** rather than picking silently. The card shows 2–3 options; user clicks one; query executes.

**Power-user escape hatch:** the chat accepts direct DSL commands (`/filter period=2025-Q1 cohort=top-quartile metric=roas`) for people who prefer precision.

---

## 8 · Rendering & visual language

### 8.1 Stack

| Layer | Tool | Rationale |
|---|---|---|
| Renderer | **react-three-fiber** (Three.js) | Shader control, GPU instancing, unique aesthetic |
| Camera | Orthographic | 2.5D feel without 3D-navigation confusion |
| Layout compute | **d3-force-3d** in Web Worker | Organic clustering, off-main-thread |
| Helpers | **@react-three/drei** | Html labels, Bounds, PerformanceMonitor |
| Post-processing | **@react-three/postprocessing** | Bloom, depth-of-field, vignette, chromatic aberration |
| Shaders | Custom GLSL | Rim-light, emission glow, liquid-metal surface, particle trails |
| State | **Zustand** | Lightweight single store, integrates with r3f hooks |
| Columnar lookup | Apache Arrow | Fast per-attribute roll-ups |
| Low-end fallback | **Sigma.js** | If `PerformanceMonitor` reports <30fps, switch renderer |

**Why not ECharts graphGL?** Visually opinionated, can't ship shaders. User's reference (`graphgl-large-internet`) is pixel-perfect *inspiration* for the neon-on-dark cosmos feeling — we hit that *and beyond* with r3f + custom shaders.

**Why not deck.gl?** Scatter/geospatial first-class; graph primitives experimental. r3f + d3-force is more flexible.

### 8.2 Visual language (the feeling)

Pure dark canvas (#0a0a0b). Vibrant neon categorical palette for attribute-type colours (greens, electric blues, magenta, amber — taking cues from the ECharts example). Edges at 0.15 opacity so nodes dominate.

**Creative nodes:**
- Circular thumbnail cut-outs (UV-masked fragment shader) from hook-frame (2s in)
- Ring colour = metric tier (green top-quartile, amber mid, red bottom) — only visible when a metric is active
- **Emission glow** from within for top performers (additive blending, not stroke)
- Node size = spend weight (normalised log scale)
- Subtle idle "breathing" animation (±3% scale) so graph feels alive

**Attribute nodes:**
- Smaller discs with neon fill per attribute-type
- Size = occurrence count (log-scaled; Ryze "medical" = 18 creatives → big; "new_year" = 1 → small)
- Labels visible only on hover or zoom-in
- Layout: each attribute-type gets a **fixed region** on canvas (claim-zone upper-left, theme-zone upper-right, hook-zone lower-centre, creator-zone middle); creatives gravitate toward their attribute centroids → same tenant sees same layout each session

**Edges:**
- Straight lines, 0.15 opacity, white by default
- When metric active: edges between winning nodes **flow** (animated particle dashes moving outward from top performers; subtle but hypnotic)
- Hover edge highlight: full opacity + colour-graded by correlation sign

**Post-processing:**
- Soft bloom on bright elements (creates the "self-evidents bubble up" glow)
- Light depth-of-field — non-focused nodes slightly blurred/desaturated
- Gentle vignette for cinematic framing

### 8.3 Performance budget

- 60 fps on mid-range laptop (Apple M-series / comparable)
- Node count target: **500 at smooth 60fps**, 2000 at 30fps
- Tenants exceeding 2000 → automatic clustering (collapse attribute-types into expandable clouds)
- Layout computation budget: <300ms after every filter mutation
- Initial load: <2s to interactive canvas (thumbnails lazy-loaded)

### 8.4 Fallback

If `PerformanceMonitor` reports <30fps for 3s consecutive, switch to Sigma.js renderer (same data, simpler shaders, still WebGL). Toast: "Switched to compatibility renderer for smoothness — you can re-enable full effects in settings."

---

## 9 · Opening canvas (establishing shot)

First load for a new session in a tenant:

1. **Camera zoomed to fit all creatives.** The entire portfolio visible as circular thumbnails scattered across the canvas, clustered around their attribute centroids.
2. **Ambient motion.** Soft drift, subtle bloom, no hard shadows.
3. **Metric default:** `roas` if performance data present, else `overall_score`. Glow-rings visible immediately.
4. **Chat side (right):** one opener message — *"Your portfolio has {N} creatives across {M} attributes. Top-performing attributes by {metric}: {list}. Ask anything."*
5. **Params side (left):** metric selector, time range brush, attribute-type toggles.
6. **No mandatory first action.** User can stare, hover, pan, click, or chat — no wizard.

**Why this matters:** the user's first impression is not a dashboard asking for filters. It's *their brand's creative cosmos*. That's the differentiation hook.

---

## 10 · Interaction patterns

### 10.1 The core loop

```
User utterance  →  Parser  →  DSL  →  Tool calls  →  GraphState mutation  →  Canvas re-renders
     OR
User param drag  →  Tool call  →  GraphState mutation  →  Canvas re-renders
     +
Lasso  →  getCohortStats  →  Labels on attribute nodes (%-fit, lift)
```

### 10.2 Chat-as-scalpel

Chat is a **filter control**, not a narrator. When user says "ta fram framgångssagor Q1 2025 metric ROAS", LLM calls in order:
```
setMetric("roas")
addFilter({ type: "period", periodIds: ["2025-Q1"] })
addFilter({ type: "cohort", metric: "roas", tier: "top-quartile" })
```
Canvas reshapes immediately. LLM response text is one sentence: *"Showing 12 creatives in Q1 2025 top-ROAS quartile. Strongest attribute: claim_type=medical (8/12)."* No prose padding.

### 10.3 Lasso → cohort-diff

User drags a lasso around any cluster in the canvas. System calls `getCohortStats(lassoSelection)` and renders:
- Each attribute node inside-lasso gets a floating label: `medical 73% / 42% (+31pp)` (in/out/lift)
- Top attributes by lift get emission-pulse; bottom ones desaturate
- Floating verdict card slides in with top-line finding and "Is this statistically significant?" CTA

Chat turn after lasso works on lasso state: *"exclude cortisol theme"* → lasso stats recompute.

### 10.4 Time-scrubber

Bottom-of-canvas slider. Drag = graph topology interpolates smoothly. Attributes that disappear over time dissolve into particles; attributes that emerge fade in with emission pulse.

### 10.5 Split-screen comparative

*"Compare Q1 2025 to Q1 2026"* → canvas splits vertically. Same attribute-type regions positioned identically on both halves. Shared attribute nodes pulse if their prevalence differs significantly.

### 10.6 Explanation paths

Click any attribute → neighbours rank-ordered by conditional mutual information with the active metric. Walk N hops: each step adds a breadcrumb. Save the walk as an explanation path (first-class object).

### 10.7 Pin = report block

Every `getCohortStats` or `hypothesisTest` result has a **Pin** button. Pinning captures `{ filterSnapshot, lassoSnapshot?, stats, chartSpec, narrativeFragment }` into the right-sidebar pin list. Reports are composed from pinned blocks later.

### 10.8 Unified undo/redo

All state mutations (manual or LLM-originated) are entries on a single undo stack. `⌘Z` walks backward regardless of source. Transparency: a log panel shows recent mutations with their origin (`manual` or `chat`).

### 10.9 Tool-call transparency

Chat LLM's tool calls render as subtle inline chips **before** the natural-language response:
```
→ addFilter(period=2025-Q1)
→ addFilter(cohort=top-quartile)
→ getTopAttributes(metric=roas, n=3)
Showing 12 creatives in Q1 2025 top-ROAS quartile. Strongest attribute: claim_type=medical (8/12).
```
User can click any chip to inspect the call or edit/rerun it.

---

## 11 · Ingestion

### 11.1 Adapters (shipped with MVP)

- **video-analyzer output** (internal; already canonical)
- **CSV uploader** with LLM-assisted column mapping
- **Paste-a-table** (accepts CSV, TSV, Markdown table, pasted spreadsheet range)
- **Northbeam CSV** (pre-configured mapping)
- **Meta Ads export** (pre-configured mapping)

### 11.2 Adapters (Phase 2)

Meta Ads API, TikTok Ads API, Shopify sync, GA4, Klaviyo.

### 11.3 LLM-assisted ingestion

When a user pastes arbitrary data into the chat, the chat:
1. Calls `ingestPayload(payload, format=auto)` — tries to detect format
2. If detection fails, asks: *"This looks like {guess}. Column 3 seems to be {guess} — confirm mapping?"* with a 3-option disambiguation card
3. On accept: upserts into the graph with the tenant-scoped canonical schema
4. Automatically re-runs the last query so the user sees the answer improve in real time

### 11.4 Coverage surfacing

Example flow: user asks *"What's ECR for our Q1 winners?"*

LLM pre-flight: `assessCoverageForQuery(query)` returns `{ covered: 12, missing: 8, impactEstimate: { confidence_delta: 0.23 } }`.

Chat message:
> I can answer this with 12/20 Q1 creatives — ECR data is missing on 8. Filling those in would tighten confidence by ≈23%. Want to add the data, or proceed with what we have?
>
> `[Upload CSV]` `[Paste data]` `[Proceed — flag uncertainty]`

User clicks "Proceed" → answer shows with a subtle `⚠ partial coverage (12/20)` badge on the chart.

---

## 12 · Persona surfaces

All surfaces share the same canvas + chat + params engine. They differ in **default view + system-prompt persona + pinned templates**.

### 12.1 Growth Manager — Hypothesis Studio (build first)

**Default view:** Opening canvas with chat focused in input; system-prompt biases LLM toward hypothesis-generation framing.

**Superpowers:**
- Chat understands hypothesis language naturally ("I think X drives Y — validate")
- Hypothesis-test shortcut: lasso A, lasso B, `⌘H` → test + verdict card
- Saved hypothesis list (sidebar) with verdict badges (`confirmed`, `partial`, `rejected`, `inconclusive`)
- Session replay — the chat DAG is the research log

**Why first:** smallest UI surface (canvas + chat + params), uses all five retrospective primitives, most direct value-unlock.

### 12.2 Editor — Creative Inspector

**Default view:** canvas pre-filtered to a single creative the editor selected (e.g., from an upstream list). Camera zoomed to focused node with neighbours (attribute nodes + shared-attribute peers).

**Superpowers:**
- Side-panel showing the creative's full `video-analyzer` decode
- Neighbour rail: top-5 peer creatives that share attributes (click → focus them)
- "Why did this win/lose?" button → auto-calls `similarCreatives` + `cohortDiff` against peers, renders a verdict card

### 12.3 Executive — Report Builder

**Default view:** empty canvas with pinned insights from Growth/Editor sessions listed as tiles.

**Superpowers:**
- Drag pins into an ordered sequence → live-preview of the narrative report
- Template chooser: "Quarterly Review", "Creative Portfolio Audit", "Hypothesis Roundup"
- LLM narrative pass: *"write the cover letter for this report"*
- Share as link (read-only snapshot) or export PDF

Report templates are **JSON DAGs of primitives + narrative prompts + conditional rendering rules**, not HTML templates. Adding a template = adding a new DAG definition, not new code.

---

## 13 · Session walkthroughs

### 13.1 Walkthrough A — Growth Manager researches Q1 2025 winners

**Turn 1 · User:** *"Ta fram alla framgångssagor 2025 Q1, metric ROAS. Jag vill hitta hypoteser."*

Parser emits:
```
setMetric(roas)
addFilter(period=2025-Q1)
addFilter(cohort=top-quartile)
getTopAttributes(metric=roas, n=5)
describeCurrentView()
```

Canvas:
- Metric glow activates (ROAS top-quartile = emerald halos)
- Non-Q1 creatives fade to 10%
- Non-top-quartile creatives fade to 10%
- 12 creatives remain in full colour, clustered near their attribute centroids
- Top-5 attributes pulse: `claim_type=medical` (biggest pulse), `theme=mushroom`, `hook_archetype=curiosity-gap`, `ugc_subtype=INT-UGC`, `creator=Silver Wells`

**Chat response:** *"Q1 2025 top-ROAS quartile = 12 creatives. Strongest attributes: medical claims (8/12), mushroom theme (10/12), curiosity-gap hook (4/12). Try lassoing the medical cluster to see their common traits."*

**Turn 2 · User lassos around the medical-cluster.**

System: `createLasso(selector=visibleCreatives ∩ medical-adjacent)` → `getCohortStats(lasso)`.

Canvas: lasso'd attribute nodes get %-fit labels floating above them: `medical 100%/0% · mushroom 88%/50% · INT-UGC 75%/33% · Silver Wells 50%/0%`.

Verdict card slides in: *"Inside the lasso: 8 creatives. Common thread = medical × INT-UGC × mushroom. Mean ROAS 0.30 vs lasso-exterior 0.18 (p=0.01, Cliff's δ=0.67). Test stored as hypothesis H-001."*

**Turn 3 · User:** *"Är detta reproducerbart i Q2 2025?"*

Parser:
```
splitView(axis=period, buckets=[2025-Q1, 2025-Q2])
applyLasso(lasso-001, side=right)  // same attribute filter on Q2 side
hypothesisTest(groupA=lasso-Q1, groupB=lasso-Q2, metric=roas)
```

Canvas splits. Same lasso auto-projects to Q2 side. Q2 finds 3 creatives matching pattern.

**Chat response:** *"Q2 2025 has 3 creatives matching the pattern at mean ROAS 0.24 — directionally confirmed but smaller sample (n=3). Hypothesis H-001 status: ✅ partial (confirmed Q1 strong; Q2 directional)."*

**Turn 4 · User pins H-001.** Insight becomes a report block.

**Session length:** 4 turns, ~2 minutes. User has validated a hypothesis across two quarters with statistical rigor.

### 13.2 Walkthrough B — Editor drills into a poor-performing creative

**Turn 0 · User arrives at Creative Inspector with `MC_45_A_M-UGC_(5)_d7` pre-selected (their latest launch underperforming).**

Canvas focuses on that creative: thumbnail large in centre, attribute-neighbours fanning out, 5 peer creatives sharing attributes visible at second ring.

Side panel shows the full analyzer decode (hook archetype, script angle, claim count, pacing, etc.).

**Turn 1 · User clicks "Why did this underperform?" shortcut.**

System:
```
createLasso(selector=focusedNode)
getCreativeNeighbors(focusedNode, k=5)
cohortDiff(groupA=[focused], groupB=top-5-neighbours, dims=all-attributes)
```

**Canvas:** the 5 peers get emerald halos (they outperform focused creative). Attribute nodes where focused DIFFERS from peers pulse red.

**Chat:** *"MC_45_A (ROAS 0.02) vs its 5 closest peers (mean ROAS 0.21). Key differences: focused ad has claim_type=none vs peers' medical (4/5); hook_archetype=story-tease vs curiosity-gap (3/5); payoff_first_glimpse_at=87s vs mean 42s. Most likely root cause: no authority claim + delayed product reveal. Pin this diagnosis?"*

**Turn 2 · User pins the diagnosis for the next creative brief.**

---

## 14 · Roadmap (rough)

| Milestone | Scope | Estimate |
|---|---|---|
| **M0 v1 retirement** | Promote v2 → canonical; delete v1 routes, workers, prompts, adapters; DB cleanup; docs update | 1 week |
| **M1 Graph foundation** | AGE on Postgres, canonical schema + RLS, Ryze loaded as reference tenant | 3 weeks |
| **M2 Primitive library** | 5 core primitives + tool API, tested against Ryze data | 4 weeks |
| **M3 Rendering prototype** | r3f canvas with ~500 Ryze nodes, basic shaders, static filters via params | 6 weeks |
| **M4 Chat scalpel** | LLM tool-calling, DSL parser, disambiguation UX, manual+chat unified state | 4 weeks |
| **M5 Lasso + cohort-diff** | Spatial selection → stats labels → verdict cards, pin flow | 3 weeks |
| **M6 Ingestion UX** | Coverage assessment, upload/paste dialogs, LLM column-mapping | 3 weeks |
| **M7 Growth Manager UI wrap** | Hypothesis list, session replay, saved hypotheses | 2 weeks |
| **M8 Polish & alpha** | Post-processing, performance tuning, mobile fallback, first-tenant onboarding | 4 weeks |

Total: ~6 months to Growth-Manager-persona alpha with one paying tenant. Editor + Report Builder personas layer on afterward (2 months each).

### 14.1 · M0 v1 retirement — task breakdown

v1 (the original Qwen-era analyzer at `/analyze/*`) has been superseded by v2 (Gemini-era, richer schema, already running the Ryze pipeline). Before any BRAND RETRO DNA work begins, we collapse the v1/v2 split so there's one canonical analyzer.

**Pre-conditions:**
- Confirm no live tenant/customer depends on a v1-only route (Ryze POC already uses v2 exclusively)
- Snapshot the database so rollback is possible

**Route & URL migration (risk: low — POC traffic only):**
- [ ] T-M0-01: Move `app/analyze/v2/api/*` → `app/analyze/api/*`
- [ ] T-M0-02: Move `app/analyze/v2/dashboard/page.tsx` → `app/analyze/dashboard/page.tsx`
- [ ] T-M0-03: Move `app/analyze/v2/video/[id]/page.tsx` → `app/analyze/video/[id]/page.tsx`
- [ ] T-M0-04: Move `app/analyze/v2/layout.tsx` + `page.tsx` → `app/analyze/` (replacing v1)
- [ ] T-M0-05: Delete the now-empty `app/analyze/v2/` directory
- [ ] T-M0-06: Add a `/analyze/v2/*` → `/analyze/*` redirect rule in `next.config.ts` for 30 days (link-safety)

**Library move (risk: medium — many imports touched):**
- [ ] T-M0-07: Move `lib/video/v2/*` → `lib/video/*` (adapters, analyze-worker, analysis schemas, scorers, etc.)
- [ ] T-M0-08: Rename `analyze-worker-v2.ts` → `analyze-worker.ts` (overwrite the v1 worker)
- [ ] T-M0-09: Rename `analysis-v2-schema.ts` → `analysis-schema.ts`
- [ ] T-M0-10: Rename `analysis-v2-base-prompt.ts` → `analysis-base-prompt.ts`; same for `analysis-v2-extended-prompt.ts`
- [ ] T-M0-11: Update all imports across `lib/`, `app/`, `components/`, `hooks/` (IDE-assisted rename)

**v1-only file deletion:**
- [ ] T-M0-12: Delete `lib/video/qwen-prompt.ts`, `qwen-schema.ts`, `analysis-extended-prompt.ts`, `analysis-extended-schema.ts` (old Qwen-era prompts/schemas v2 doesn't use)
- [ ] T-M0-13: Delete old `lib/video/analyze-worker.ts`, `analyze-repair.ts`, `gemini-adapter.ts` if not referenced by the new worker
- [ ] T-M0-14: Delete old `lib/video/prompts.ts` and any v1-only helpers in `extractors.ts` / `extraction-summary.ts`
- [ ] T-M0-15: Audit `lib/video/batch/*` and remove v1-only pipeline code (keep v2-batch)
- [ ] T-M0-16: Audit `components/video/*` (non-v2) — migrate any still-used shared cards into `components/video/` root, delete the rest

**Component namespace cleanup:**
- [ ] T-M0-17: Move `components/video/v2/*` → `components/video/` (merge with shared components)
- [ ] T-M0-18: Resolve naming collisions (e.g., if `analyses-table.tsx` exists in both)
- [ ] T-M0-19: Delete the `components/video/v2/` directory

**Database cleanup:**
- [ ] T-M0-20: Audit `lib/db/schema.ts` — identify v1-only columns (e.g., fields only the old analyzer writes)
- [ ] T-M0-21: Write a Drizzle migration dropping v1-only columns (or mark deprecated with a sunset date if live data exists)
- [ ] T-M0-22: Clear v1-analysis blob-URLs from Vercel Blob where `version < 2`

**Docs + tests + deploy:**
- [ ] T-M0-23: Update `HANDOFF.md` — remove v1 bug notes, document the single analyzer
- [ ] T-M0-24: Update any README references, `CLAUDE.md` project notes, spec `#17 References` once paths are stable
- [ ] T-M0-25: Re-run Vitest + `pnpm exec tsc --noEmit` + `pnpm check` — all green
- [ ] T-M0-26: Verify Ryze pipeline still runs end-to-end (upload → analyze → dashboard → export)
- [ ] T-M0-27: Deploy to staging; smoke-test `/analyze/dashboard`, `/analyze/video/[id]`, upload flow, batch flow
- [ ] T-M0-28: Deploy to production; monitor logs for 24h for v1-route 404s (captured by the redirect rule)

**Exit criteria for M0:**
- Zero files match `*v1*`, `*v2*`, `qwen-*` in `lib/video/`, `app/analyze/`, `components/video/`
- Typecheck + lint + tests green
- Ryze end-to-end flow unchanged from user perspective
- `git log --oneline` shows a clean `chore: retire v1` final commit

---

## 15 · Out of scope (this iteration)

- **v2 semantic changes during M0 retirement.** M0 is purely structural (rename, delete, redirect). No schema or behavioural changes to the analyzer itself — see §14.1.
- **Predictive scoring at platform level.** Prediction is inside `video-analyzer` only, as features on the `Creative` node.
- **Public benchmark layer.** Build after 5+ tenants.
- **Cross-tenant research.** After 10+ tenants, with explicit opt-in and k-anonymity.
- **Mobile-first UX.** Desktop-first; mobile shows read-only "frozen view" of shared reports.
- **Real-time streaming data.** Ingestion is batch/pull for now.
- **Native SQL/Cypher console.** DSL escape hatch exists; a raw-Cypher console comes later for power users.

---

## 16 · Open questions (need decisions before plan)

1. **Thumbnail extraction policy.** Hook-frame (2s) vs payoff-frame (product reveal) vs auto-picked "most distinctive". Propose: hook-frame as default, editor override.
2. **LLM choice for chat parser.** Sonnet for intelligence vs Haiku for cost/latency vs self-hosted for privacy. Propose: Sonnet during alpha, evaluate Haiku after N=1000 sessions.
3. **Talent gap on shaders.** Existing team has React+Tailwind strong; WebGL/GLSL experience unknown. Hiring decision or training sprint?
4. **State persistence.** Session state in localStorage only (ephemeral) vs server-persisted (share-a-link works). Propose: localStorage during alpha, Postgres-backed sessions in M7.
5. **Undo stack granularity.** Every mutation OR only semantic groups? Propose: group by chat-turn-or-UI-drag; atomic undo per group.

---

## 17 · References

- `video-analyzer` canonical schema → `lib/video/analysis-schema.ts`, `lib/db/schema.ts` (post-M0 paths; currently at `lib/video/v2/analysis-v2-schema.ts`)
- Ryze retrospective outputs → `/home/gustaf/Projects/RyzeWithKrezu/analys/outputs/`
- Apache AGE → https://age.apache.org/
- react-three-fiber → https://r3f.docs.pmnd.rs/
- d3-force-3d → https://github.com/vasturiano/d3-force-3d
- Visual-language inspiration: Apache ECharts `graphgl-large-internet` example (user-provided, aesthetic reference only; tech stack differs)
