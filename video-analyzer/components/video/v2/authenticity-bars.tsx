"use client";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { band: "low" | "moderate" | "high"; avgEcr: number; count: number };

export function AuthenticityBars({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">
        Authenticity U-shape (avg ECR by band)
      </h3>
      <ResponsiveContainer height={200} minWidth={280} width="100%">
        <BarChart data={rows}>
          <XAxis dataKey="band" fontSize={11} />
          <YAxis domain={[0, 1]} fontSize={10} width={32} />
          <Tooltip />
          <Bar dataKey="avgEcr" fill="#a855f7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
