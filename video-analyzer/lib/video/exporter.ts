import ExcelJS from "exceljs";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import type {
  ExportChartRefs,
  PerformanceData,
  VideoExtraction,
} from "./types";

type Analysis = {
  extraction: VideoExtraction;
  performance?: PerformanceData;
};

export async function exportAnalysis(
  analysis: Analysis,
  chartRefs: ExportChartRefs = {}
): Promise<void> {
  const zip = new JSZip();
  const { extraction, performance } = analysis;

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

  const xlsxBuffer = await wb.xlsx.writeBuffer();
  zip.file("data.xlsx", xlsxBuffer);

  // 3. charts PNGs
  for (const [name, el] of Object.entries(chartRefs)) {
    if (!el) continue;
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
      if (!b64) return;
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
