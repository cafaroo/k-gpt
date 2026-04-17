import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, getAnalysisById } from "@/lib/db/queries";
import { analysis, video } from "@/lib/db/schema";
import { v2Session as auth } from "@/lib/video/v2/session";

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

  let fullPayload: unknown = null;
  if (row.Analysis.analysisBlobUrl) {
    try {
      const res = await fetch(row.Analysis.analysisBlobUrl);
      if (res.ok) {
        fullPayload = await res.json();
      }
    } catch {
      // Fall through — return what we have
    }
  }
  return NextResponse.json({
    analysis: row.Analysis,
    video: row.Video,
    fullPayload,
  });
}

export async function DELETE(
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

  // Collect every blob URL we own for this analysis + its video.
  const blobs = [
    a.analysisBlobUrl,
    a.rawBaseBlobUrl,
    a.rawExtendedBlobUrl,
    v.blobUrl,
  ].filter((u): u is string => typeof u === "string" && u.length > 0);

  // Best-effort blob cleanup — we still drop DB rows even if blob delete
  // fails (e.g. already gone). Failures are logged, not returned.
  await Promise.all(
    blobs.map((url) =>
      del(url).catch((err) => {
        console.warn("[v2 delete] blob del failed", url, err);
      })
    )
  );

  await db
    .delete(analysis)
    .where(and(eq(analysis.id, a.id), eq(analysis.userId, session.user.id)));
  await db
    .delete(video)
    .where(and(eq(video.id, v.id), eq(video.userId, session.user.id)));

  return NextResponse.json({ ok: true, deleted: { analysisId: a.id, videoId: v.id } });
}
