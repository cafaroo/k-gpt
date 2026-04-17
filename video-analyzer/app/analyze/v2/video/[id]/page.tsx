import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ResearchRow } from "@/components/video/v2/research-row";
import { getAnalysisById } from "@/lib/db/queries";

export default async function PerVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const row = await getAnalysisById(id, session.user.id);
  if (!row) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Analysis not found.
      </div>
    );
  }
  const a = row.Analysis;
  const v = row.Video;

  let fullPayload: any = null;
  if (a.analysisBlobUrl) {
    try {
      const res = await fetch(a.analysisBlobUrl);
      if (res.ok) fullPayload = await res.json();
    } catch {
      // no-op
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[2fr_3fr] gap-6">
        <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden">
          {/* biome-ignore lint/a11y/useMediaCaption: no caption for POC */}
          <video src={v.blobUrl} controls className="h-full w-full object-contain" />
        </div>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold">{v.filename}</h1>
          <div className="text-sm text-muted-foreground">
            {fullPayload?.overall?.tagline ?? "—"}
          </div>
          <div className="text-sm">{fullPayload?.overall?.summary ?? ""}</div>
        </div>
      </div>

      <ResearchRow
        ecr={a.ecr ? Number(a.ecr) : 0}
        nawp={a.nawp ? Number(a.nawp) : 0}
        colloquiality={a.colloquialityScore ? Number(a.colloquialityScore) : 0}
        authenticityBand={a.authenticityBand}
        ecrRationale={fullPayload?.researchMeta?.ecr?.rationale}
        nawpRationale={fullPayload?.researchMeta?.nawp?.rationale}
      />

      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        Tier 1 / 2 / 3 cards render here (Task 7.2).
      </div>
    </div>
  );
}
