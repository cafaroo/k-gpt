"use client";
import { Bar, BarChart, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";

export function EcrHistogram({ ecrs }: { ecrs: number[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
    count: 0,
  }));
  for (const v of ecrs) {
    const idx = Math.min(9, Math.floor(v * 10));
    buckets[idx].count++;
  }
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">ECR distribution</h3>
      <ResponsiveContainer height={200} minWidth={280} width="100%">
        <BarChart data={buckets}>
          <XAxis dataKey="range" fontSize={10} />
          <YAxis fontSize={10} allowDecimals={false} width={24} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
