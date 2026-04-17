import ExcelJS from "exceljs";
import JSZip from "jszip";

type AnalysisRow = {
  id: string;
  videoId: string;
  createdAt: Date;
  overallScore: number | null;
  ecr: string | null;
  nawp: string | null;
  colloquialityScore: string | null;
  authenticityBand: "low" | "moderate" | "high" | null;
  brandHeritageSalience: "absent" | "moderate" | "high" | null;
  hookScore: string | null;
  pacingScore: string | null;
  cutsPerMinute: string | null;
  voiceoverCadence: string | null;
  emotionalTransitionScore: string | null;
  niche: string | null;
  formatPrimary: string | null;
  platformBestFit: string | null;
  schemaVersion: string;
  // Batch 4
  scriptAngle?: string | null;
  primaryGender?: string | null;
  socioeconomic?: string | null;
  peopleCountMax?: number | null;
  eyeContactScore?: string | null;
};

type VideoRow = {
  id: string;
  filename: string;
  durationSec: string;
  width: number;
  height: number;
  aspectRatio: string;
};

function slugify(s: string): string {
  return s.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
}

async function fetchFullPayload(
  blobUrl: string | null
): Promise<Record<string, unknown> | null> {
  if (!blobUrl) {
    return null;
  }
  try {
    const res = await fetch(blobUrl);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function buildPerVideoExportZip(
  analysis: AnalysisRow & { analysisBlobUrl: string | null },
  video: VideoRow
): Promise<{ buffer: Uint8Array; filename: string }> {
  const zip = new JSZip();
  const payload = await fetchFullPayload(analysis.analysisBlobUrl);

  // 1. Full analysis JSON
  if (payload) {
    zip.file("analysis.json", JSON.stringify(payload, null, 2));
  }

  // 2. Database row (hot fields)
  zip.file(
    "metadata.json",
    JSON.stringify({ analysis, video }, null, 2)
  );

  // 3. XLSX
  const wb = new ExcelJS.Workbook();
  wb.creator = "Video Analyzer v2";

  const meta = wb.addWorksheet("Overview");
  meta.columns = [
    { header: "Key", key: "k", width: 28 },
    { header: "Value", key: "v", width: 60 },
  ];
  const p = payload ?? {};
  const overall = (p.overall ?? {}) as Record<string, unknown>;
  meta.addRows([
    { k: "Filename", v: video.filename },
    { k: "Duration (s)", v: video.durationSec },
    { k: "Dimensions", v: `${video.width}×${video.height} (${video.aspectRatio})` },
    { k: "Schema version", v: analysis.schemaVersion },
    { k: "Analysis created", v: analysis.createdAt.toISOString() },
    {},
    { k: "Overall score", v: overall.score ?? analysis.overallScore ?? "" },
    { k: "Tagline", v: overall.tagline ?? "" },
    { k: "Summary", v: overall.summary ?? "" },
    {},
    { k: "ECR", v: analysis.ecr ?? "" },
    { k: "NAWP", v: analysis.nawp ?? "" },
    { k: "Colloquiality", v: analysis.colloquialityScore ?? "" },
    { k: "Authenticity band", v: analysis.authenticityBand ?? "" },
    { k: "Brand heritage", v: analysis.brandHeritageSalience ?? "" },
    { k: "Voiceover cadence", v: analysis.voiceoverCadence ?? "" },
    { k: "Emotional transition", v: analysis.emotionalTransitionScore ?? "" },
    { k: "Niche", v: analysis.niche ?? "" },
    { k: "Format", v: analysis.formatPrimary ?? "" },
    { k: "Best platform fit", v: analysis.platformBestFit ?? "" },
    {},
    { k: "Script angle", v: analysis.scriptAngle ?? "" },
    { k: "Primary gender target", v: analysis.primaryGender ?? "" },
    { k: "Socioeconomic target", v: analysis.socioeconomic ?? "" },
    { k: "People count (max)", v: analysis.peopleCountMax ?? "" },
    { k: "Eye contact score", v: analysis.eyeContactScore ?? "" },
  ]);

  const scenes = Array.isArray(p.scenes) ? (p.scenes as any[]) : [];
  if (scenes.length > 0) {
    const sh = wb.addWorksheet("Scenes");
    sh.columns = [
      { header: "Start", key: "s", width: 10 },
      { header: "End", key: "e", width: 10 },
      { header: "Function", key: "f", width: 14 },
      { header: "Label", key: "l", width: 32 },
      { header: "Description", key: "d", width: 60 },
      { header: "Visual style", key: "vs", width: 30 },
    ];
    for (const sc of scenes) {
      sh.addRow({
        s: Number(sc.start ?? 0),
        e: Number(sc.end ?? 0),
        f: sc.function ?? "",
        l: sc.label ?? "",
        d: sc.description ?? "",
        vs: sc.visualStyle ?? "",
      });
    }
  }

  const beats = Array.isArray(p.beatMap) ? (p.beatMap as any[]) : [];
  if (beats.length > 0) {
    const sh = wb.addWorksheet("Beats");
    sh.columns = [
      { header: "Start", key: "s", width: 10 },
      { header: "End", key: "e", width: 10 },
      { header: "Type", key: "t", width: 16 },
      { header: "Strength", key: "st", width: 10 },
      { header: "Description", key: "d", width: 60 },
    ];
    for (const b of beats) {
      sh.addRow({
        s: Number(b.start ?? 0),
        e: Number(b.end ?? 0),
        t: b.type ?? "",
        st: Number(b.strength ?? 0),
        d: b.description ?? "",
      });
    }
  }

  const insights = Array.isArray(p.insights) ? (p.insights as any[]) : [];
  if (insights.length > 0) {
    const sh = wb.addWorksheet("Insights");
    sh.columns = [
      { header: "Area", key: "a", width: 14 },
      { header: "Impact", key: "im", width: 10 },
      { header: "Observation", key: "ob", width: 60 },
      { header: "Evidence", key: "ev", width: 50 },
      { header: "Note", key: "n", width: 40 },
    ];
    for (const ins of insights) {
      sh.addRow({
        a: ins.area ?? "",
        im: ins.impact ?? "",
        ob: ins.observation ?? "",
        ev: ins.evidence ?? "",
        n: ins.note ?? "",
      });
    }
  }

  const rules = Array.isArray(p.ruleCompliance) ? (p.ruleCompliance as any[]) : [];
  if (rules.length > 0) {
    const sh = wb.addWorksheet("Rule Compliance");
    sh.columns = [
      { header: "Rule ID", key: "r", width: 30 },
      { header: "Title", key: "t", width: 40 },
      { header: "Met", key: "m", width: 10 },
      { header: "Score", key: "sc", width: 10 },
      { header: "Evidence", key: "ev", width: 50 },
    ];
    for (const rule of rules) {
      sh.addRow({
        r: rule.ruleId ?? "",
        t: rule.title ?? "",
        m: rule.met ? "YES" : "NO",
        sc: rule.score ?? "",
        ev: rule.evidence ?? "",
      });
    }
  }

  const ext = (p.extended ?? {}) as Record<string, unknown>;
  const transcript = (ext.transcript ?? {}) as Record<string, unknown>;
  const segments = Array.isArray(transcript.segments)
    ? (transcript.segments as any[])
    : [];
  if (segments.length > 0) {
    const sh = wb.addWorksheet("Transcript");
    sh.columns = [
      { header: "Start", key: "s", width: 10 },
      { header: "End", key: "e", width: 10 },
      { header: "Speaker", key: "sp", width: 14 },
      { header: "Text", key: "t", width: 80 },
    ];
    for (const seg of segments) {
      sh.addRow({
        s: Number(seg.start ?? 0),
        e: Number(seg.end ?? 0),
        sp: seg.speaker ?? "",
        t: seg.text ?? "",
      });
    }
  }

  const trust = Array.isArray(ext.trustSignals) ? (ext.trustSignals as any[]) : [];
  const moments = Array.isArray(ext.microMoments) ? (ext.microMoments as any[]) : [];
  const interrupts = Array.isArray(ext.patternInterrupts)
    ? (ext.patternInterrupts as any[])
    : [];
  if (trust.length + moments.length + interrupts.length > 0) {
    const sh = wb.addWorksheet("Events");
    sh.columns = [
      { header: "Timestamp", key: "t", width: 10 },
      { header: "Lane", key: "l", width: 14 },
      { header: "Type", key: "ty", width: 22 },
      { header: "Score", key: "sc", width: 10 },
      { header: "Description", key: "d", width: 60 },
    ];
    for (const e of interrupts) {
      sh.addRow({
        t: Number(e.timestamp ?? 0),
        l: "interrupt",
        ty: e.type ?? "",
        sc: Number(e.effectiveness ?? 0),
        d: e.description ?? "",
      });
    }
    for (const e of trust) {
      sh.addRow({
        t: Number(e.timestamp ?? 0),
        l: "trust",
        ty: e.type ?? "",
        sc: Number(e.strength ?? 0),
        d: e.description ?? "",
      });
    }
    for (const e of moments) {
      sh.addRow({
        t: Number(e.timestamp ?? 0),
        l: "moment",
        ty: e.kind ?? "",
        sc: e.impactOnRetention ?? "",
        d: e.description ?? "",
      });
    }
  }

  // ── Batch 4 sheets ───────────────────────────────────────────────────────

  const extPayload = (p.extended ?? {}) as Record<string, unknown>;

  // People sheet
  const actors = Array.isArray(
    (extPayload.peopleAnalysis as any)?.actors
  )
    ? ((extPayload.peopleAnalysis as any).actors as any[])
    : [];
  if (actors.length > 0) {
    const sh = wb.addWorksheet("People");
    sh.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Role", key: "role", width: 16 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Age range", key: "age", width: 12 },
      { header: "Ethnicity", key: "eth", width: 16 },
      { header: "Screen time %", key: "st", width: 14 },
      { header: "Energy", key: "en", width: 10 },
      { header: "Trustworthiness", key: "tr", width: 16 },
      { header: "Eye contact share", key: "ec", width: 18 },
      { header: "Camera treatment", key: "cam", width: 18 },
      { header: "Style", key: "style", width: 50 },
    ];
    for (const actor of actors) {
      sh.addRow({
        id: actor.id ?? "",
        role: actor.role ?? "",
        gender: actor.gender ?? "",
        age: actor.ageRange ?? "",
        eth: actor.ethnicity ?? "",
        st: Number(actor.screenTimePct ?? 0),
        en: Number(actor.energyLevel ?? 0),
        tr: Number(actor.trustworthiness ?? 0),
        ec: Number(actor.eyeContactShare ?? 0),
        cam: actor.cameraTreatment ?? "",
        style: actor.styleDescription ?? "",
      });
    }
  }

  // Cuts sheet
  const cuts = Array.isArray(extPayload.cutsMap)
    ? (extPayload.cutsMap as any[])
    : [];
  if (cuts.length > 0) {
    const sh = wb.addWorksheet("Cuts");
    sh.columns = [
      { header: "Timestamp (s)", key: "ts", width: 14 },
      { header: "Type", key: "type", width: 16 },
      { header: "Before shot", key: "before", width: 40 },
      { header: "After shot", key: "after", width: 40 },
      { header: "Intent", key: "intent", width: 40 },
    ];
    for (const cut of cuts) {
      sh.addRow({
        ts: Number(cut.timestamp ?? 0),
        type: cut.type ?? "",
        before: cut.beforeShot ?? "",
        after: cut.afterShot ?? "",
        intent: cut.intent ?? "",
      });
    }
  }

  // Script sheet
  const sa = (extPayload.scriptAngle ?? {}) as Record<string, unknown>;
  if (sa.angle) {
    const sh = wb.addWorksheet("Script");
    sh.columns = [
      { header: "Key", key: "k", width: 22 },
      { header: "Value", key: "v", width: 80 },
    ];
    sh.addRows([
      { k: "Angle", v: sa.angle ?? "" },
      { k: "Narrative style", v: sa.narrativeStyle ?? "" },
      { k: "Hook type", v: sa.hookType ?? "" },
      { k: "Thesis", v: sa.thesis ?? "" },
      {},
    ]);
    const acts = Array.isArray(sa.acts) ? (sa.acts as any[]) : [];
    if (acts.length > 0) {
      sh.addRow({ k: "— Acts —", v: "" });
      for (const act of acts) {
        sh.addRow({
          k: `Act: ${act.name ?? ""}`,
          v: `${act.start ?? 0}s – ${act.end ?? 0}s | ${act.summary ?? ""}`,
        });
      }
    }
    const hooks = Array.isArray(sa.copyHooks) ? (sa.copyHooks as string[]) : [];
    if (hooks.length > 0) {
      sh.addRow({ k: "", v: "" });
      sh.addRow({ k: "— Copy hooks —", v: "" });
      for (const hook of hooks) {
        sh.addRow({ k: "", v: hook });
      }
    }
  }

  // Audience profile sheet
  const ap = (p.audienceProfile ?? {}) as Record<string, unknown>;
  if (ap.primaryAgeRange) {
    const sh = wb.addWorksheet("AudienceProfile");
    sh.columns = [
      { header: "Key", key: "k", width: 22 },
      { header: "Value", key: "v", width: 80 },
    ];
    sh.addRows([
      { k: "Primary age range", v: ap.primaryAgeRange ?? "" },
      { k: "Primary gender", v: ap.primaryGender ?? "" },
      { k: "Socioeconomic", v: ap.socioeconomic ?? "" },
      { k: "Urbanicity", v: ap.urbanicity ?? "" },
      { k: "Region", v: ap.region ?? "" },
      { k: "Purchase readiness", v: ap.purchaseReadiness ?? "" },
      {},
      {
        k: "Lifestyle markers",
        v: Array.isArray(ap.lifestyleMarkers)
          ? (ap.lifestyleMarkers as string[]).join(", ")
          : "",
      },
      {
        k: "Values",
        v: Array.isArray(ap.values) ? (ap.values as string[]).join(", ") : "",
      },
      {
        k: "Pains",
        v: Array.isArray(ap.pains) ? (ap.pains as string[]).join(", ") : "",
      },
      {
        k: "Desires",
        v: Array.isArray(ap.desires)
          ? (ap.desires as string[]).join(", ")
          : "",
      },
    ]);
  }

  const xlsx = await wb.xlsx.writeBuffer();
  zip.file("data.xlsx", xlsx as ArrayBuffer);

  const arrayBuf = await zip.generateAsync({ type: "uint8array" });
  const filename = `${slugify(video.filename) || "analysis"}-v2.zip`;
  return { buffer: arrayBuf, filename };
}

export async function buildBatchExportZip(
  rows: Array<{ analysis: AnalysisRow & { analysisBlobUrl: string | null }; video: VideoRow }>
): Promise<{ buffer: Uint8Array; filename: string }> {
  const zip = new JSZip();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Video Analyzer v2";
  const sheet = wb.addWorksheet("Leaderboard");
  sheet.columns = [
    { header: "Filename", key: "f", width: 40 },
    { header: "Duration (s)", key: "d", width: 12 },
    { header: "Overall", key: "ov", width: 10 },
    { header: "ECR", key: "ec", width: 8 },
    { header: "NAWP", key: "nw", width: 8 },
    { header: "Colloquiality", key: "co", width: 12 },
    { header: "Authenticity", key: "au", width: 14 },
    { header: "Brand heritage", key: "bh", width: 14 },
    { header: "Hook score", key: "hs", width: 10 },
    { header: "Pacing score", key: "ps", width: 12 },
    { header: "Cuts/min", key: "cpm", width: 10 },
    { header: "VO cadence", key: "vc", width: 10 },
    { header: "Emo transition", key: "et", width: 14 },
    { header: "Niche", key: "nc", width: 14 },
    { header: "Format", key: "fm", width: 14 },
    { header: "Best platform", key: "pf", width: 14 },
    // Batch 4
    { header: "Script angle", key: "sa", width: 18 },
    { header: "Gender target", key: "gt", width: 14 },
    { header: "Socioeconomic", key: "se", width: 14 },
    { header: "People (max)", key: "pm", width: 12 },
    { header: "Eye contact", key: "eye", width: 12 },
    { header: "Created", key: "cr", width: 22 },
  ];
  for (const { analysis: a, video: v } of rows) {
    sheet.addRow({
      f: v.filename,
      d: v.durationSec,
      ov: a.overallScore ?? "",
      ec: a.ecr ?? "",
      nw: a.nawp ?? "",
      co: a.colloquialityScore ?? "",
      au: a.authenticityBand ?? "",
      bh: a.brandHeritageSalience ?? "",
      hs: a.hookScore ?? "",
      ps: a.pacingScore ?? "",
      cpm: a.cutsPerMinute ?? "",
      vc: a.voiceoverCadence ?? "",
      et: a.emotionalTransitionScore ?? "",
      nc: a.niche ?? "",
      fm: a.formatPrimary ?? "",
      pf: a.platformBestFit ?? "",
      sa: a.scriptAngle ?? "",
      gt: a.primaryGender ?? "",
      se: a.socioeconomic ?? "",
      pm: a.peopleCountMax ?? "",
      eye: a.eyeContactScore ?? "",
      cr: a.createdAt.toISOString(),
    });
  }
  zip.file("leaderboard.xlsx", (await wb.xlsx.writeBuffer()) as ArrayBuffer);

  const index = rows.map(({ analysis: a, video: v }) => ({
    analysisId: a.id,
    filename: v.filename,
    overallScore: a.overallScore,
    ecr: a.ecr,
    nawp: a.nawp,
    colloquiality: a.colloquialityScore,
    authenticityBand: a.authenticityBand,
    createdAt: a.createdAt.toISOString(),
  }));
  zip.file("index.json", JSON.stringify(index, null, 2));

  // Per-video folders
  const perVideo = zip.folder("per-video");
  if (perVideo) {
    await Promise.all(
      rows.map(async ({ analysis: a, video: v }) => {
        const slug = slugify(v.filename) || a.id;
        const dir = perVideo.folder(`${slug}_${a.id.slice(0, 8)}`);
        if (!dir) return;
        const payload = await fetchFullPayload(a.analysisBlobUrl);
        if (payload) {
          dir.file("analysis.json", JSON.stringify(payload, null, 2));
        }
        dir.file("metadata.json", JSON.stringify({ analysis: a, video: v }, null, 2));
      })
    );
  }

  const buffer = await zip.generateAsync({ type: "uint8array" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { buffer, filename: `analyses-v2-${stamp}.zip` };
}
