"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type Row = {
  id: string;
  filename: string | null;
  thumbnailUrl: string | null;
  overallScore: number | null;
  ecr: string | null;
  nawp: string | null;
  colloquialityScore: string | null;
  authenticityBand: "low" | "moderate" | "high" | null;
  niche?: string | null;
  platformBestFit?: string | null;
  createdAt: string;
  durationSec?: string | number | null;
};

type Props = {
  rows: Row[];
};

const AUTH_COLORS: Record<string, string> = {
  low: "#10b981",
  moderate: "#f59e0b",
  high: "#3b82f6",
};

const PLATFORM_COLORS = [
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
];

function median(nums: number[]): number {
  if (nums.length === 0) {
    return 0;
  }
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function avg(nums: number[]): number {
  if (nums.length === 0) {
    return 0;
  }
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function DashboardAdvancedCharts({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        No data yet to chart.
      </div>
    );
  }

  // Scatter data: ECR x Colloquiality, colored by authenticityBand
  const scatterData = rows
    .filter((r) => r.ecr != null && r.colloquialityScore != null)
    .map((r) => ({
      ecr: Number(r.ecr),
      colloq: Number(r.colloquialityScore),
      band: r.authenticityBand ?? "low",
      name: r.filename ?? r.id,
    }));

  // Niche distribution
  const nicheMap = new Map<string, { count: number; ecrs: number[] }>();
  for (const r of rows) {
    const niche = r.niche ?? "unknown";
    if (!nicheMap.has(niche)) {
      nicheMap.set(niche, { count: 0, ecrs: [] });
    }
    const entry = nicheMap.get(niche)!;
    entry.count++;
    if (r.ecr != null) {
      entry.ecrs.push(Number(r.ecr));
    }
  }
  const nicheData = Array.from(nicheMap.entries())
    .map(([niche, { count, ecrs }]) => ({
      niche,
      count,
      avgEcr: ecrs.length > 0 ? avg(ecrs) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Platform best-fit distribution
  const platformMap = new Map<string, number>();
  for (const r of rows) {
    const p = r.platformBestFit ?? "unknown";
    platformMap.set(p, (platformMap.get(p) ?? 0) + 1);
  }
  const platformData = Array.from(platformMap.entries()).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  // Mini stats
  const nawpNums = rows
    .filter((r) => r.nawp != null)
    .map((r) => Number(r.nawp));
  const colloqNums = rows
    .filter((r) => r.colloquialityScore != null)
    .map((r) => Number(r.colloquialityScore));
  const highAuthCount = rows.filter(
    (r) => r.authenticityBand === "high"
  ).length;
  const medNawp = median(nawpNums);
  const avgColloq = avg(colloqNums);

  return (
    <div className="space-y-4">
      {/* Mini stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Median NAWP
          </div>
          <div className="text-xl font-bold tabular-nums mt-0.5">
            {medNawp.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Avg Colloquiality
          </div>
          <div className="text-xl font-bold tabular-nums mt-0.5">
            {avgColloq.toFixed(1)}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            High authenticity
          </div>
          <div className="text-xl font-bold tabular-nums mt-0.5">
            {highAuthCount}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Analysed
          </div>
          <div className="text-xl font-bold tabular-nums mt-0.5">
            {rows.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ECR × Colloquiality scatter */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">ECR × Colloquiality</h3>
          {scatterData.length > 0 ? (
            <>
              <ResponsiveContainer height={220} minWidth={280} width="100%">
                <ScatterChart
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <XAxis
                    dataKey="ecr"
                    domain={[0, 1]}
                    fontSize={10}
                    label={{
                      value: "ECR",
                      position: "insideBottom",
                      offset: -4,
                      fontSize: 10,
                    }}
                    name="ECR"
                    type="number"
                  />
                  <YAxis
                    dataKey="colloq"
                    domain={[0, 10]}
                    fontSize={10}
                    label={{
                      value: "Colloq",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 10,
                    }}
                    name="Colloq"
                    type="number"
                    width={32}
                  />
                  <ZAxis range={[40, 40]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }
                      const d = payload[0]?.payload as (typeof scatterData)[0];
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md max-w-[180px]">
                          <div className="font-medium truncate">{d.name}</div>
                          <div className="text-muted-foreground">
                            ECR: {d.ecr.toFixed(3)}
                          </div>
                          <div className="text-muted-foreground">
                            Colloq: {d.colloq.toFixed(1)}
                          </div>
                          <div className="capitalize text-muted-foreground">
                            Auth: {d.band}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData} name="Videos">
                    {scatterData.map((entry, i) => (
                      <Cell
                        fill={AUTH_COLORS[entry.band] ?? "#6b7280"}
                        key={`scatter-${i}`}
                        opacity={0.75}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-1 justify-center">
                {Object.entries(AUTH_COLORS).map(([band, color]) => (
                  <span
                    className="flex items-center gap-1 text-[10px] text-muted-foreground"
                    key={band}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full inline-block"
                      style={{ background: color }}
                    />
                    {band}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not enough data for scatter.
            </p>
          )}
        </div>

        {/* Platform fit pie */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Platform best-fit</h3>
          {platformData.length > 0 ? (
            <ResponsiveContainer height={220} minWidth={280} width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={platformData}
                  dataKey="value"
                  innerRadius={50}
                  label={({
                    name,
                    percent,
                  }: {
                    name?: string;
                    percent?: number;
                  }) =>
                    (percent ?? 0) > 0.05
                      ? `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                      : ""
                  }
                  labelLine={false}
                  nameKey="name"
                  outerRadius={90}
                >
                  {platformData.map((_, i) => (
                    <Cell
                      fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                      key={`plat-${i}`}
                      opacity={0.85}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: "11px" }}
                  formatter={(v, name) => [v, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">
              No platform fit data.
            </p>
          )}
        </div>
      </div>

      {/* Niche distribution */}
      {nicheData.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Niche distribution</h3>
          <ResponsiveContainer
            height={Math.max(120, nicheData.length * 30)}
            minWidth={280}
            width="100%"
          >
            <BarChart
              data={nicheData}
              layout="vertical"
              margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
            >
              <XAxis allowDecimals={false} fontSize={10} type="number" />
              <YAxis
                dataKey="niche"
                fontSize={10}
                type="category"
                width={100}
              />
              <Tooltip
                contentStyle={{ fontSize: "11px" }}
                formatter={(v, name) => [
                  name === "count"
                    ? v
                    : typeof v === "number"
                      ? v.toFixed(3)
                      : v,
                  name === "count" ? "Videos" : "Avg ECR",
                ]}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                label={{ position: "right", fontSize: 10 }}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
