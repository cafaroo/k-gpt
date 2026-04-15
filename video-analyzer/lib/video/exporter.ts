import ExcelJS from "exceljs";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import type { AudioAnalysis } from "./audio-schema";
import { computeBatchInsights } from "./batch/insights";
import type { Batch } from "./batch/types";
import type { QwenAnalysis } from "./qwen-schema";
import type {
  ExportChartRefs,
  PerformanceData,
  VideoExtraction,
} from "./types";

type Analysis = {
  extraction: VideoExtraction;
  performance?: PerformanceData;
  qwenAnalysis?: QwenAnalysis | null;
  audioAnalysis?: AudioAnalysis | null;
};

export async function exportAnalysis(
  analysis: Analysis,
  chartRefs: ExportChartRefs = {}
): Promise<void> {
  const zip = new JSZip();
  const { extraction, performance, qwenAnalysis, audioAnalysis } = analysis;

  // 0. AI analysis JSONs
  if (qwenAnalysis) {
    zip.file("qwen-analysis.json", JSON.stringify(qwenAnalysis, null, 2));
  }
  if (audioAnalysis) {
    zip.file("audio-analysis.json", JSON.stringify(audioAnalysis, null, 2));
    if (audioAnalysis.voiceover.transcript) {
      zip.file("transcript.txt", audioAnalysis.voiceover.transcript);
    }
  }

  // 1. extraction.json (without huge gray32 arrays and dataUrls)
  const slim = {
    ...extraction,
    frames: extraction.frames.map((f) => ({
      timestamp: f.timestamp,
      brightness: f.brightness,
      dominantColor: f.dominantColor,
    })),
  };
  zip.file(
    "extraction.json",
    JSON.stringify({ extraction: slim, performance }, null, 2)
  );

  // 2. data.xlsx with 4 sheets
  const wb = new ExcelJS.Workbook();
  wb.creator = "Video Content Analyzer";

  const metaSheet = wb.addWorksheet("Metadata");
  metaSheet.columns = [
    { header: "Key", key: "k", width: 24 },
    { header: "Value", key: "v", width: 40 },
  ];
  for (const [k, v] of Object.entries(extraction.metadata)) {
    metaSheet.addRow({ k, v });
  }
  if (performance && Object.keys(performance).length > 0) {
    metaSheet.addRow({});
    metaSheet.addRow({ k: "— Performance —" });
    for (const [k, v] of Object.entries(performance)) {
      metaSheet.addRow({ k, v: v ?? "" });
    }
  }

  const framesSheet = wb.addWorksheet("Frames");
  framesSheet.columns = [
    { header: "Timestamp (s)", key: "t", width: 14 },
    { header: "Brightness", key: "b", width: 12 },
    { header: "Dominant color", key: "c", width: 16 },
  ];
  for (const f of extraction.frames) {
    framesSheet.addRow({ t: f.timestamp, b: f.brightness, c: f.dominantColor });
  }

  const audioSheet = wb.addWorksheet("Audio");
  audioSheet.columns = [
    { header: "Start (s)", key: "s", width: 12 },
    { header: "End (s)", key: "e", width: 12 },
    { header: "RMS (dB)", key: "r", width: 12 },
    { header: "Peak (dB)", key: "p", width: 12 },
    { header: "Silent", key: "si", width: 10 },
  ];
  for (const a of extraction.audioSegments) {
    audioSheet.addRow({
      s: +a.startTime.toFixed(3),
      e: +a.endTime.toFixed(3),
      r: +a.rmsLevel.toFixed(2),
      p: +a.peak.toFixed(2),
      si: a.isSilent,
    });
  }

  const motionSheet = wb.addWorksheet("Motion");
  motionSheet.columns = [
    { header: "Start (s)", key: "s", width: 12 },
    { header: "End (s)", key: "e", width: 12 },
    { header: "Score", key: "sc", width: 10 },
    { header: "Level", key: "l", width: 10 },
  ];
  for (const m of extraction.motionSegments) {
    motionSheet.addRow({
      s: +m.startTime.toFixed(3),
      e: +m.endTime.toFixed(3),
      sc: m.motionScore,
      l: m.interpretation,
    });
  }

  const scenesSheet = wb.addWorksheet("Scenes");
  scenesSheet.columns = [
    { header: "Timestamp (s)", key: "t", width: 14 },
    { header: "Score", key: "sc", width: 10 },
  ];
  for (const s of extraction.sceneChanges) {
    scenesSheet.addRow({ t: +s.timestamp.toFixed(3), sc: +s.score.toFixed(3) });
  }

  // Qwen scenes + recommendations (if present)
  if (qwenAnalysis) {
    const scenesSheetQ = wb.addWorksheet("Qwen Scenes");
    scenesSheetQ.columns = [
      { header: "Start (s)", key: "s", width: 10 },
      { header: "End (s)", key: "e", width: 10 },
      { header: "Function", key: "f", width: 14 },
      { header: "Label", key: "l", width: 30 },
      { header: "Description", key: "d", width: 60 },
      { header: "Text on screen", key: "t", width: 30 },
    ];
    for (const sc of qwenAnalysis.scenes) {
      scenesSheetQ.addRow({
        s: +sc.start.toFixed(2),
        e: +sc.end.toFixed(2),
        f: sc.function,
        l: sc.label,
        d: sc.description,
        t: sc.textOnScreen ?? "",
      });
    }

    const recSheet = wb.addWorksheet("Recommendations");
    recSheet.columns = [
      { header: "Priority", key: "p", width: 10 },
      { header: "Area", key: "a", width: 12 },
      { header: "Issue", key: "i", width: 50 },
      { header: "Suggestion", key: "s", width: 60 },
      { header: "Expected impact", key: "x", width: 40 },
    ];
    for (const r of qwenAnalysis.recommendations) {
      recSheet.addRow({
        p: r.priority,
        a: r.area,
        i: r.issue,
        s: r.suggestion,
        x: r.expectedImpact,
      });
    }

    const scoresSheet = wb.addWorksheet("Scores");
    scoresSheet.columns = [
      { header: "Metric", key: "m", width: 24 },
      { header: "Value", key: "v", width: 40 },
    ];
    scoresSheet.addRow({ m: "Overall score", v: qwenAnalysis.overall.score });
    scoresSheet.addRow({ m: "Tagline", v: qwenAnalysis.overall.tagline });
    scoresSheet.addRow({ m: "Summary", v: qwenAnalysis.overall.summary });
    scoresSheet.addRow({ m: "Hook score", v: qwenAnalysis.hook.score });
    scoresSheet.addRow({
      m: "Hook duration (s)",
      v: qwenAnalysis.hook.duration,
    });
    scoresSheet.addRow({ m: "Pacing score", v: qwenAnalysis.pacing.score });
    scoresSheet.addRow({ m: "Pacing rhythm", v: qwenAnalysis.pacing.rhythm });
    scoresSheet.addRow({
      m: "Cuts/min",
      v: qwenAnalysis.pacing.cutsPerMinute,
    });
    scoresSheet.addRow({ m: "CTA exists", v: qwenAnalysis.cta.exists });
    scoresSheet.addRow({ m: "CTA clarity", v: qwenAnalysis.cta.clarity });
    scoresSheet.addRow({ m: "Visual variety", v: qwenAnalysis.visual.variety });
    scoresSheet.addRow({
      m: "Predicted completion",
      v: qwenAnalysis.predictedMetrics.completionRate,
    });
    scoresSheet.addRow({
      m: "Predicted engagement",
      v: qwenAnalysis.predictedMetrics.engagementRate,
    });
  }

  const xlsxBuffer = await wb.xlsx.writeBuffer();
  zip.file("data.xlsx", xlsxBuffer);

  // 3. charts PNGs
  for (const [name, el] of Object.entries(chartRefs)) {
    if (!el) {
      continue;
    }
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      zip.file(`charts/${name}.png`, dataUrl.split(",")[1] ?? "", {
        base64: true,
      });
    } catch (err) {
      console.warn(`[exporter] failed to snapshot ${name}`, err);
    }
  }

  // 4. keyframes
  const framesDir = zip.folder("frames");
  if (framesDir) {
    extraction.frames.forEach((f, i) => {
      const b64 = f.dataUrl.split(",")[1];
      if (!b64) {
        return;
      }
      const idx = String(i).padStart(4, "0");
      framesDir.file(`frame_${idx}_${f.timestamp.toFixed(0)}s.jpg`, b64, {
        base64: true,
      });
    });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const baseName = extraction.metadata.filename.replace(/\.[^.]+$/, "");
  a.download = `${baseName || "video"}-analysis.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Batch export ────────────────────────────────────────────────────────

export async function exportBatch(batch: Batch): Promise<void> {
  const zip = new JSZip();

  const insights = computeBatchInsights(batch.videos);
  zip.file(
    "batch-insights.json",
    JSON.stringify(
      {
        batchId: batch.id,
        createdAt: new Date(batch.createdAt).toISOString(),
        videoCount: batch.videos.length,
        performanceSource: batch.performanceSource,
        insights,
      },
      null,
      2
    )
  );

  // Leaderboard xlsx
  const wb = new ExcelJS.Workbook();
  wb.creator = "Video Content Analyzer";
  const sheet = wb.addWorksheet("Leaderboard");
  sheet.columns = [
    { header: "Filename", key: "f", width: 40 },
    { header: "Status", key: "s", width: 12 },
    { header: "Overall", key: "ov", width: 10 },
    { header: "Tagline", key: "tg", width: 40 },
    { header: "Hook style", key: "hk", width: 18 },
    { header: "Hook score", key: "hs", width: 12 },
    { header: "Pacing rhythm", key: "pr", width: 14 },
    { header: "Pacing score", key: "ps", width: 12 },
    { header: "CTA type", key: "ct", width: 18 },
    { header: "CTA clarity", key: "cc", width: 12 },
    { header: "Format", key: "fm", width: 16 },
    { header: "Niche", key: "nc", width: 14 },
    { header: "Rules met", key: "rm", width: 12 },
    { header: "Views", key: "vw", width: 12 },
    { header: "CTR", key: "ctr", width: 10 },
    { header: "Saves", key: "sv", width: 10 },
    { header: "Completion", key: "cr", width: 12 },
  ];
  for (const v of batch.videos) {
    const q = v.qwen;
    const row = {
      f: v.filename,
      s: v.status,
      ov: q?.overall.score ?? "",
      tg: q?.overall.tagline ?? "",
      hk: q?.hook.primaryStyle ?? "",
      hs: q?.hook.score ?? "",
      pr: q?.pacing.rhythm ?? "",
      ps: q?.pacing.score ?? "",
      ct: q?.cta.exists ? q.cta.type : "none",
      cc: q?.cta.exists ? q.cta.clarity : "",
      fm: q?.format.primary ?? "",
      nc: q?.niche.detected ?? "",
      rm: q
        ? `${q.ruleCompliance.filter((r) => r.met).length}/${q.ruleCompliance.length}`
        : "",
      vw: v.performance?.views ?? "",
      ctr:
        v.performance?.clickThroughRate === undefined
          ? ""
          : v.performance.clickThroughRate,
      sv: v.performance?.likes ?? "",
      cr:
        v.performance?.completionRate === undefined
          ? ""
          : v.performance.completionRate,
    };
    sheet.addRow(row);
  }
  zip.file("leaderboard.xlsx", await wb.xlsx.writeBuffer());

  // Per-video folders
  const perVideoDir = zip.folder("per-video");
  if (perVideoDir) {
    for (const v of batch.videos) {
      const slug = v.filename
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_");
      const dir = perVideoDir.folder(slug);
      if (!dir) {
        continue;
      }
      if (v.qwen) {
        dir.file("qwen-analysis.json", JSON.stringify(v.qwen, null, 2));
      }
      if (v.audio) {
        dir.file("audio-analysis.json", JSON.stringify(v.audio, null, 2));
        if (v.audio.voiceover.transcript) {
          dir.file("transcript.txt", v.audio.voiceover.transcript);
        }
      }
      if (v.extraction) {
        const slim = {
          ...v.extraction,
          frames: v.extraction.frames.map((f) => ({
            timestamp: f.timestamp,
            brightness: f.brightness,
            dominantColor: f.dominantColor,
          })),
        };
        dir.file(
          "extraction.json",
          JSON.stringify(
            { extraction: slim, performance: v.performance },
            null,
            2
          )
        );
      }
      if (v.error) {
        dir.file("error.txt", v.error);
      }
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `batch-${batch.id}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
