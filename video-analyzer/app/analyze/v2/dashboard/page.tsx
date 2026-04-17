import { redirect } from "next/navigation";
import { AnalysesTable } from "@/components/video/v2/analyses-table";
import { AuthenticityBars } from "@/components/video/v2/authenticity-bars";
import { DashboardAdvancedCharts } from "@/components/video/v2/dashboard-advanced-charts";
import { EcrHistogram } from "@/components/video/v2/ecr-histogram";
import { listAnalyses } from "@/lib/db/queries";
import { v2Session as auth } from "@/lib/video/v2/session";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { rows, total } = await listAnalyses({
    userId: session.user.id,
    limit: 50,
  });

  const medianEcr =
    rows.length === 0
      ? null
      : (() => {
          const nums = rows
            .map((r) => (r.ecr ? Number(r.ecr) : null))
            .filter((n): n is number => n !== null)
            .sort((a, b) => a - b);
          return nums[Math.floor(nums.length / 2)] ?? null;
        })();
  const moderateCount = rows.filter(
    (r) => r.authenticityBand === "moderate"
  ).length;

  const ecrs = rows
    .map((r) => (r.ecr ? Number(r.ecr) : null))
    .filter((n): n is number => n !== null);
  const bands: Record<"low" | "moderate" | "high", number[]> = {
    low: [],
    moderate: [],
    high: [],
  };
  for (const r of rows) {
    if (r.authenticityBand && r.ecr) {
      bands[r.authenticityBand].push(Number(r.ecr));
    }
  }
  const authenticityRows = (["low", "moderate", "high"] as const).map(
    (band) => ({
      band,
      count: bands[band].length,
      avgEcr:
        bands[band].length > 0
          ? bands[band].reduce((a, b) => a + b, 0) / bands[band].length
          : 0,
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {total} analyses · research-grounded metrics.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Videos" value={String(total)} />
        <StatCard
          label="Median ECR"
          value={medianEcr === null ? "—" : medianEcr.toFixed(2)}
        />
        <StatCard
          hint="Research flags U-shape risk"
          label="In moderate-auth zone"
          value={String(moderateCount)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EcrHistogram ecrs={ecrs} />
        <AuthenticityBars rows={authenticityRows} />
      </div>
      <DashboardAdvancedCharts
        rows={rows.map((r) => ({
          id: r.id,
          filename: r.filename,
          thumbnailUrl: r.thumbnailUrl,
          overallScore: r.overallScore,
          ecr: r.ecr,
          nawp: r.nawp,
          colloquialityScore: r.colloquialityScore,
          authenticityBand: r.authenticityBand,
          niche: r.niche,
          platformBestFit: r.platformBestFit,
          createdAt: r.createdAt.toISOString(),
          durationSec: r.durationSec,
        }))}
      />
      <AnalysesTable
        rows={rows.map((r) => ({
          id: r.id,
          filename: r.filename,
          thumbnailUrl: r.thumbnailUrl,
          overallScore: r.overallScore,
          ecr: r.ecr,
          nawp: r.nawp,
          colloquialityScore: r.colloquialityScore,
          authenticityBand: r.authenticityBand,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
