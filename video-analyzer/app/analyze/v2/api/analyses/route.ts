import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { listAnalyses, type AnalysisFilters } from "@/lib/db/queries";

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
    authenticityBandIn: p.getAll("authenticity") as ("low" | "moderate" | "high")[],
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
