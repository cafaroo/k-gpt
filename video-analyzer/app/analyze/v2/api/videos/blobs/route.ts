import { del } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import { video } from "@/lib/db/schema";
import { v2Session as auth } from "@/lib/video/v2/session";

export const maxDuration = 300;

// Purges the uploaded video binaries (Blob storage) for this user while
// keeping the Analysis rows + analysis JSON + Video metadata intact. The
// video player on per-video pages goes offline; everything else still
// renders from DB + analysis blob.

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ id: video.id, blobUrl: video.blobUrl })
    .from(video)
    .where(
      and(eq(video.userId, session.user.id), isNull(video.videoDeletedAt))
    );

  const urls = rows
    .map((r) => r.blobUrl)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  const CHUNK = 20;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const slice = urls.slice(i, i + CHUNK);
    await del(slice).catch((err) => {
      console.warn("[v2 videos purge] chunk del failed", err);
    });
  }

  await db
    .update(video)
    .set({ videoDeletedAt: new Date() })
    .where(
      and(eq(video.userId, session.user.id), isNull(video.videoDeletedAt))
    );

  return NextResponse.json({
    ok: true,
    purged: { videos: rows.length, blobs: urls.length },
  });
}
