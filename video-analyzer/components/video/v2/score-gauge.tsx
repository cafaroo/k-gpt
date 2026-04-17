type Props = {
  value: number; // 0-1 by default, 0-max if max provided
  max?: number; // default 1
  label: string;
  sublabel?: string;
  color?: string;
};

export function ScoreGauge({
  value,
  max = 1,
  label,
  sublabel,
  color = "#3b82f6",
}: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  const circumference = 2 * Math.PI * 36;
  const dash = circumference * pct;
  return (
    <div className="rounded-lg border p-4 flex flex-col items-center gap-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-2xl font-semibold tabular-nums">
        {max === 1 ? pct.toFixed(2) : value.toFixed(1)}
      </div>
      {sublabel && (
        <div className="text-[10px] text-muted-foreground text-center">
          {sublabel}
        </div>
      )}
    </div>
  );
}
