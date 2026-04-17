import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v2Session as auth } from "@/lib/video/v2/session";
import { db } from "@/lib/db/queries";
import { analysis } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [row] = await db
    .select({
      id: analysis.id,
      status: analysis.status,
      completenessScore: analysis.completenessScore,
      latencyMs: analysis.latencyMs,
      errorMessage: analysis.errorMessage,
      completedAt: analysis.completedAt,
    })
    .from(analysis)
    .where(and(eq(analysis.id, id), eq(analysis.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}
