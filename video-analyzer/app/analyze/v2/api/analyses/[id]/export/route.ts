import { NextResponse } from "next/server";
import { getAnalysisById } from "@/lib/db/queries";
import { buildPerVideoExportZip } from "@/lib/video/v2/exporter";
import { v2Session as auth } from "@/lib/video/v2/session";

export const maxDuration = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await getAnalysisById(id, session.user.id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const a = row.Analysis;
  const v = row.Video;
  const { buffer, filename } = await buildPerVideoExportZip(
    {
      id: a.id,
      videoId: a.videoId,
      createdAt: a.createdAt,
      overallScore: a.overallScore,
      ecr: a.ecr,
      nawp: a.nawp,
      colloquialityScore: a.colloquialityScore,
      authenticityBand: a.authenticityBand,
      brandHeritageSalience: a.brandHeritageSalience,
      hookScore: a.hookScore,
      pacingScore: a.pacingScore,
      cutsPerMinute: a.cutsPerMinute,
      voiceoverCadence: a.voiceoverCadence,
      emotionalTransitionScore: a.emotionalTransitionScore,
      niche: a.niche,
      formatPrimary: a.formatPrimary,
      platformBestFit: a.platformBestFit,
      schemaVersion: a.schemaVersion,
      analysisBlobUrl: a.analysisBlobUrl,
    },
    {
      id: v.id,
      filename: v.filename,
      durationSec: String(v.durationSec),
      width: v.width,
      height: v.height,
      aspectRatio: v.aspectRatio,
    }
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
