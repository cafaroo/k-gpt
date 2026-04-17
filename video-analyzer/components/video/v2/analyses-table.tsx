"use client";
import Link from "next/link";

type Row = {
  id: string;
  filename: string;
  thumbnailUrl: string | null;
  overallScore: number | null;
  ecr: string | null;
  nawp: string | null;
  colloquialityScore: string | null;
  authenticityBand: "low" | "moderate" | "high" | null;
  createdAt: string;
};

export function AnalysesTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
        No analyses yet. Upload a video to get started.
      </div>
    );
  }
  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2">Filename</th>
            <th className="px-4 py-2">Overall</th>
            <th className="px-4 py-2">ECR</th>
            <th className="px-4 py-2">NAWP</th>
            <th className="px-4 py-2">Colloq</th>
            <th className="px-4 py-2">Authenticity</th>
            <th className="px-4 py-2 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
              key={r.id}
            >
              <td className="px-4 py-2">
                <Link
                  className="hover:underline"
                  href={`/analyze/v2/video/${r.id}`}
                >
                  {r.filename}
                </Link>
              </td>
              <td className="px-4 py-2 tabular-nums">
                {r.overallScore ?? "—"}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {r.ecr ? Number(r.ecr).toFixed(2) : "—"}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {r.nawp ? Number(r.nawp).toFixed(2) : "—"}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {r.colloquialityScore
                  ? Number(r.colloquialityScore).toFixed(1)
                  : "—"}
              </td>
              <td className="px-4 py-2">
                {r.authenticityBand ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      r.authenticityBand === "moderate"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-emerald-500/15 text-emerald-600"
                    }`}
                  >
                    {r.authenticityBand}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
