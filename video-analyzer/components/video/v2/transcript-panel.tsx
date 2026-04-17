"use client";

import { ChevronDown, ChevronUp, Globe } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Segment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

type Transcript = {
  language?: string;
  segments?: Segment[];
  fullText?: string;
};

type Props = {
  transcript?: Transcript | null;
  onSeek?: (time: number) => void;
};

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

export function TranscriptPanel({ transcript, onSeek }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!transcript || (!transcript.segments?.length && !transcript.fullText)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transcript available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const segments = transcript.segments ?? [];
  const charCount = transcript.fullText?.length ?? 0;
  const segCount = segments.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Transcript</CardTitle>
            {transcript.language && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Globe className="h-3 w-3" />
                {transcript.language.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(charCount > 0 || segCount > 0) && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {charCount > 0 && `${charCount.toLocaleString()} chars`}
                {charCount > 0 && segCount > 0 && " · "}
                {segCount > 0 && `${segCount} segments`}
              </span>
            )}
            <button
              className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
              onClick={() => setExpanded((v) => !v)}
              type="button"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Expand
                </>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {segments.length > 0 ? (
            <div className="space-y-px max-h-[400px] overflow-y-auto pr-1">
              {segments.map((seg, i) => (
                <button
                  className={`w-full text-left flex gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    hoveredIdx === i ? "bg-muted" : "hover:bg-muted/60"
                  } ${onSeek ? "cursor-pointer" : ""}`}
                  key={`seg-${i}-${seg.start}`}
                  onClick={() => onSeek?.(seg.start)}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  type="button"
                >
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 pt-0.5 w-[96px]">
                    {fmt(seg.start)}–{fmt(seg.end)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {seg.speaker && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-2">
                        {seg.speaker}
                      </span>
                    )}
                    <span className="text-xs leading-relaxed">{seg.text}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : transcript.fullText ? (
            <p className="text-sm leading-relaxed text-muted-foreground max-h-[300px] overflow-y-auto">
              {transcript.fullText}
            </p>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
