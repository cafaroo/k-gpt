"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VideoJob } from "@/lib/video/batch/types";
import { BatchSparkline } from "./batch-sparkline";

type Props = {
  videos: VideoJob[];
  hasPerformanceData: boolean;
  onPick: (id: string) => void;
};

type SortKey =
  | "filename"
  | "overall"
  | "hook"
  | "pacing"
  | "cta"
  | "views"
  | "ctr"
  | "rules";

function ScoreBadge({ value, max = 100 }: { value: number; max?: number }) {
  const pct = value / max;
  const color =
    pct >= 0.75
      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
      : pct >= 0.5
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : "bg-red-500/15 text-red-600 border-red-500/30";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}
    >
      {value.toFixed(max === 100 ? 0 : 1)}
    </span>
  );
}

function Header({
  k,
  active,
  dir,
  onClick,
  children,
  className,
}: {
  k: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon =
    active === k ? (dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <TableHead
      className={`cursor-pointer select-none ${className ?? ""}`}
      onClick={() => onClick(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <Icon className="h-3 w-3 opacity-60" />
      </span>
    </TableHead>
  );
}

export function BatchLeaderboard({
  videos,
  hasPerformanceData,
  onPick,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...videos].filter((v) => v.status === "done" && v.qwen);
    arr.sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      const aq = a.qwen;
      const bq = b.qwen;
      if (!(aq && bq)) {
        return 0;
      }
      switch (sortKey) {
        case "filename":
          return mul * a.filename.localeCompare(b.filename);
        case "overall":
          return mul * (aq.overall.score - bq.overall.score);
        case "hook":
          return mul * (aq.hook.score - bq.hook.score);
        case "pacing":
          return mul * (aq.pacing.score - bq.pacing.score);
        case "cta":
          return (
            mul *
            ((aq.cta.exists ? aq.cta.clarity : 0) -
              (bq.cta.exists ? bq.cta.clarity : 0))
          );
        case "views":
          return (
            mul * ((a.performance?.views ?? 0) - (b.performance?.views ?? 0))
          );
        case "ctr":
          return (
            mul *
            ((a.performance?.clickThroughRate ?? 0) -
              (b.performance?.clickThroughRate ?? 0))
          );
        case "rules": {
          const aMet = aq.ruleCompliance.filter((r) => r.met).length;
          const bMet = bq.ruleCompliance.filter((r) => r.met).length;
          return mul * (aMet - bMet);
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [videos, sortKey, sortDir]);

  const toggle = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  if (sorted.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <Header
              active={sortKey}
              dir={sortDir}
              k="filename"
              onClick={toggle}
            >
              Video
            </Header>
            <Header
              active={sortKey}
              className="text-right"
              dir={sortDir}
              k="overall"
              onClick={toggle}
            >
              Overall
            </Header>
            <Header active={sortKey} dir={sortDir} k="hook" onClick={toggle}>
              Hook
            </Header>
            <Header active={sortKey} dir={sortDir} k="pacing" onClick={toggle}>
              Pacing
            </Header>
            <Header active={sortKey} dir={sortDir} k="cta" onClick={toggle}>
              CTA
            </Header>
            {hasPerformanceData && (
              <>
                <Header
                  active={sortKey}
                  className="text-right"
                  dir={sortDir}
                  k="views"
                  onClick={toggle}
                >
                  Views
                </Header>
                <Header
                  active={sortKey}
                  className="text-right"
                  dir={sortDir}
                  k="ctr"
                  onClick={toggle}
                >
                  CTR
                </Header>
              </>
            )}
            <Header
              active={sortKey}
              className="text-right"
              dir={sortDir}
              k="rules"
              onClick={toggle}
            >
              Rules
            </Header>
            <TableHead>Pacing curve</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((v) => {
            const q = v.qwen;
            if (!q) {
              return null;
            }
            const rulesMet = q.ruleCompliance.filter((r) => r.met).length;
            const total = q.ruleCompliance.length;
            return (
              <TableRow
                className="cursor-pointer"
                key={v.id}
                onClick={() => onPick(v.id)}
              >
                <TableCell>
                  {v.thumbnailDataUrl ? (
                    // biome-ignore lint/performance/noImgElement: data URL
                    <img
                      alt=""
                      className="h-10 w-8 rounded object-cover"
                      src={v.thumbnailDataUrl}
                    />
                  ) : (
                    <div className="bg-muted h-10 w-8 rounded" />
                  )}
                </TableCell>
                <TableCell>
                  <div
                    className="max-w-[180px] truncate font-medium text-sm"
                    title={v.filename}
                  >
                    {v.filename}
                  </div>
                  <div className="text-muted-foreground text-[10px] italic max-w-[180px] truncate">
                    {q.overall.tagline}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ScoreBadge value={q.overall.score} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{q.hook.primaryStyle}</Badge>
                  <span className="text-muted-foreground ml-1 text-xs">
                    {q.hook.score.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{q.pacing.rhythm}</Badge>
                  <span className="text-muted-foreground ml-1 text-xs">
                    {q.pacing.score.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell>
                  {q.cta.exists ? (
                    <>
                      <Badge variant="outline">{q.cta.type}</Badge>
                      <span className="text-muted-foreground ml-1 text-xs">
                        {q.cta.clarity.toFixed(1)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">none</span>
                  )}
                </TableCell>
                {hasPerformanceData && (
                  <>
                    <TableCell className="text-right text-xs tabular-nums">
                      {v.performance?.views?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {v.performance?.clickThroughRate === undefined
                        ? "—"
                        : `${(v.performance.clickThroughRate * 100).toFixed(2)}%`}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right">
                  <span
                    className={`text-xs font-semibold ${rulesMet / total >= 0.6 ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {rulesMet}/{total}
                  </span>
                </TableCell>
                <TableCell>
                  <BatchSparkline data={q.pacing.intensityCurve} />
                </TableCell>
                <TableCell>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(v.id);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
