import { and, eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { analysis, video } from "@/lib/db/schema";
import { runAnalysisV2 } from "@/lib/video/v2/analyze-worker-v2";

export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { videoId: string };
  if (!body.videoId) {
    return NextResponse.json({ error: "missing videoId" }, { status: 400 });
  }

  const [videoRow] = await db
    .select()
    .from(video)
    .where(and(eq(video.id, body.videoId), eq(video.userId, session.user.id)))
    .limit(1);
  if (!videoRow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [analysisRow] = await db
    .insert(analysis)
    .values({
      videoId: videoRow.id,
      userId: session.user.id,
      status: "pending",
    })
    .returning({ id: analysis.id });

  after(async () => {
    await runAnalysisV2({
      analysisId: analysisRow.id,
      videoId: videoRow.id,
      userId: session.user.id,
      videoUrl: videoRow.blobUrl,
      metadata: {
        filename: videoRow.filename,
        duration: Number(videoRow.durationSec),
        fps: 0,
        width: videoRow.width,
        height: videoRow.height,
        aspectRatio: videoRow.aspectRatio,
        fileSize: videoRow.fileSizeBytes,
        codec: "",
        bitrate: 0,
      },
    });
  });

  return NextResponse.json(
    { jobId: analysisRow.id, status: "pending" },
    { status: 202 }
  );
}
