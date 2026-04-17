import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { batch } from "@/lib/db/schema";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name } = (await request.json()) as { name?: string };
  const [row] = await db
    .insert(batch)
    .values({ userId: session.user.id, name: name ?? `Batch ${new Date().toISOString()}` })
    .returning({ id: batch.id, name: batch.name });
  return NextResponse.json({ batchId: row.id, name: row.name });
}
