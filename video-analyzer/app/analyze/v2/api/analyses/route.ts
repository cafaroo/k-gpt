import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { type AnalysisFilters, db, listAnalyses } from "@/lib/db/queries";
import { analysis, video } from "@/lib/db/schema";
import { v2Session as auth } from "@/lib/video/v2/session";

export const maxDuration = 300;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const p = url.searchParams;

  const filters: AnalysisFilters = {
    userId: session.user.id,
    ecrGte: p.get("ecrGte") ? Number(p.get("ecrGte")) : undefined,
    ecrLte: p.get("ecrLte") ? Number(p.get("ecrLte")) : undefined,
    authenticityBandIn: p.getAll("authenticity") as (
      | "low"
      | "moderate"
      | "high"
    )[],
    nicheIn: p.getAll("niche"),
    platformBestFitIn: p.getAll("platform"),
    limit: p.get("limit") ? Number(p.get("limit")) : 50,
    offset: p.get("offset") ? Number(p.get("offset")) : 0,
    sortField: (p.get("sort") as AnalysisFilters["sortField"]) ?? "createdAt",
    sortDir: (p.get("dir") as "asc" | "desc") ?? "desc",
  };

  const result = await listAnalyses(filters);
  return NextResponse.json(result);
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Grab every analysis + video row owned by this user, including their
  // blob URLs, before we drop the DB rows.
  const allAnalyses = await db
    .select({
      analysisBlobUrl: analysis.analysisBlobUrl,
      rawBaseBlobUrl: analysis.rawBaseBlobUrl,
      rawExtendedBlobUrl: analysis.rawExtendedBlobUrl,
    })
    .from(analysis)
    .where(eq(analysis.userId, session.user.id));

  const allVideos = await db
    .select({ blobUrl: video.blobUrl })
    .from(video)
    .where(eq(video.userId, session.user.id));

  const blobs: string[] = [];
  for (const a of allAnalyses) {
    for (const u of [a.analysisBlobUrl, a.rawBaseBlobUrl, a.rawExtendedBlobUrl]) {
      if (typeof u === "string" && u.length > 0) blobs.push(u);
    }
  }
  for (const v of allVideos) {
    if (typeof v.blobUrl === "string" && v.blobUrl.length > 0) {
      blobs.push(v.blobUrl);
    }
  }

  // Blob del() accepts an array, but batch in chunks to be gentle.
  const CHUNK = 20;
  for (let i = 0; i < blobs.length; i += CHUNK) {
    const slice = blobs.slice(i, i + CHUNK);
    await del(slice).catch((err) => {
      console.warn("[v2 clear-all] blob chunk del failed", err);
    });
  }

  await db.delete(analysis).where(eq(analysis.userId, session.user.id));
  await db.delete(video).where(eq(video.userId, session.user.id));

  return NextResponse.json({
    ok: true,
    deleted: {
      analyses: allAnalyses.length,
      videos: allVideos.length,
      blobs: blobs.length,
    },
  });
}
