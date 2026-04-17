import { NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import { video } from "@/lib/db/schema";
import { v2Session as auth } from "@/lib/video/v2/session";

// Only metadata is posted to this route now — the file itself is uploaded
// directly from the browser to Vercel Blob via /api/blob/upload (handleUpload
// + client upload()). That bypasses Vercel's ~4.5 MB serverless body limit
// which was rejecting real video uploads with HTTP 413.

type Body = {
  blobUrl: string;
  filename: string;
  fileSize: number;
  batchId?: string | null;
  metadata: {
    duration: number;
    width: number;
    height: number;
    aspectRatio: string;
  };
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.blobUrl || !body.filename || !body.metadata) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const [row] = await db
    .insert(video)
    .values({
      userId: session.user.id,
      batchId: body.batchId ?? null,
      blobUrl: body.blobUrl,
      filename: body.filename,
      fileSizeBytes: body.fileSize,
      durationSec: body.metadata.duration.toFixed(2),
      width: body.metadata.width,
      height: body.metadata.height,
      aspectRatio: body.metadata.aspectRatio,
    })
    .returning({ id: video.id });

  return NextResponse.json({ videoId: row.id, blobUrl: body.blobUrl });
}
