import { NextResponse } from "next/server";
import { v2Session as auth } from "@/lib/video/v2/session";
import { getAnalysisById } from "@/lib/db/queries";

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
