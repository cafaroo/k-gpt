import { ScoreGauge } from "./score-gauge";

type Props = {
  ecr: number;
  nawp: number;
  colloquiality: number;
  authenticityBand: "low" | "moderate" | "high" | null;
  ecrRationale?: string;
  nawpRationale?: string;
};

export function ResearchRow({
  ecr,
  nawp,
  colloquiality,
  authenticityBand,
  ecrRationale,
  nawpRationale,
}: Props) {
  const bandColor = {
    low: "text-emerald-500",
    moderate: "text-amber-500",
    high: "text-emerald-500",
    null: "text-muted-foreground",
  } as const;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <ScoreGauge value={ecr} label="ECR" sublabel={ecrRationale} color="#3b82f6" />
      <ScoreGauge value={nawp} label="NAWP" sublabel={nawpRationale} color="#a855f7" />
      <ScoreGauge
        value={colloquiality}
        max={10}
        label="Colloquiality"
        sublabel="Zhang 2025 top predictor"
        color="#f59e0b"
      />
      <div className="rounded-lg border p-4 flex flex-col items-center gap-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Authenticity
        </div>
        <div
          className={`text-3xl font-semibold capitalize ${bandColor[authenticityBand ?? "null"]}`}
        >
          {authenticityBand ?? "—"}
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          {authenticityBand === "moderate"
            ? "⚠ U-shape risk zone (Meng 2024)"
            : "Outside risk zone"}
        </div>
      </div>
    </div>
  );
}
