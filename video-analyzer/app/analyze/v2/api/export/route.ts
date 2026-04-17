import { NextResponse } from "next/server";
import { listAnalyses } from "@/lib/db/queries";
import { buildBatchExportZip } from "@/lib/video/v2/exporter";
import { v2Session as auth } from "@/lib/video/v2/session";

export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pull every completed analysis for this user.
  const { rows } = await listAnalyses({
    userId: session.user.id,
    limit: 500,
  });

  // listAnalyses returns a lean join shape (hot fields + filename/duration).
  // We need the full Analysis row to get blob URL + every hot-field column.
  // The simplest path: re-select Analysis + Video for each row id. That
  // keeps the exporter generic and avoids widening the list query.
  const { db } = await import("@/lib/db/queries");
  const { analysis, video } = await import("@/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ error: "no analyses" }, { status: 404 });
  }
  const fullRows = await db
    .select()
    .from(analysis)
    .innerJoin(video, eq(video.id, analysis.videoId))
    .where(inArray(analysis.id, ids));

  const payload = fullRows.map((r) => ({
    analysis: {
      id: r.Analysis.id,
      videoId: r.Analysis.videoId,
      createdAt: r.Analysis.createdAt,
      overallScore: r.Analysis.overallScore,
      ecr: r.Analysis.ecr,
      nawp: r.Analysis.nawp,
      colloquialityScore: r.Analysis.colloquialityScore,
      authenticityBand: r.Analysis.authenticityBand,
      brandHeritageSalience: r.Analysis.brandHeritageSalience,
      hookScore: r.Analysis.hookScore,
      pacingScore: r.Analysis.pacingScore,
      cutsPerMinute: r.Analysis.cutsPerMinute,
      voiceoverCadence: r.Analysis.voiceoverCadence,
      emotionalTransitionScore: r.Analysis.emotionalTransitionScore,
      niche: r.Analysis.niche,
      formatPrimary: r.Analysis.formatPrimary,
      platformBestFit: r.Analysis.platformBestFit,
      schemaVersion: r.Analysis.schemaVersion,
      analysisBlobUrl: r.Analysis.analysisBlobUrl,
    },
    video: {
      id: r.Video.id,
      filename: r.Video.filename,
      durationSec: String(r.Video.durationSec),
      width: r.Video.width,
      height: r.Video.height,
      aspectRatio: r.Video.aspectRatio,
    },
  }));

  const { buffer, filename } = await buildBatchExportZip(payload);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
