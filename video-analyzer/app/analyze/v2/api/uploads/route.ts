import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { video } from "@/lib/db/schema";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const batchId = form.get("batchId") as string | null;
  const metaRaw = form.get("metadata") as string | null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (!metaRaw) {
    return NextResponse.json({ error: "missing metadata" }, { status: 400 });
  }
  const metadata = JSON.parse(metaRaw) as {
    duration: number;
    width: number;
    height: number;
    aspectRatio: string;
  };

  const blob = await put(`v2/videos/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const [row] = await db
    .insert(video)
    .values({
      userId: session.user.id,
      batchId: batchId || null,
      blobUrl: blob.url,
      filename: file.name,
      fileSizeBytes: file.size,
      durationSec: metadata.duration.toFixed(2),
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.aspectRatio,
    })
    .returning({ id: video.id });

  return NextResponse.json({ videoId: row.id, blobUrl: blob.url });
}
