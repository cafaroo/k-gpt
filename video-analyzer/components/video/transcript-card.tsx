"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisExtended } from "@/lib/video/analysis-extended-schema";

type Props = {
  transcript: AnalysisExtended["transcript"];
  onSeek?: (time: number) => void;
};

export function TranscriptCard({ transcript, onSeek }: Props) {
  const [showFull, setShowFull] = useState(false);
  const { language, segments, fullText } = transcript;

  if (segments.length === 0 && !fullText) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Transcript</CardTitle>
        <div className="flex items-center gap-2">
          <span className="bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium uppercase">
            {language}
          </span>
          {fullText && (
            <Button
              onClick={() => setShowFull((v) => !v)}
              size="sm"
              variant="ghost"
            >
              {showFull ? "Show segments" : "Show full text"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showFull ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {fullText}
          </p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {segments.map((s) => (
              <button
                className="hover:bg-muted/40 flex w-full items-start gap-2 rounded-md p-1.5 text-left text-xs"
                key={`seg-${s.start}-${s.end}`}
                onClick={() => onSeek?.(s.start)}
                type="button"
              >
                <span className="text-muted-foreground w-14 shrink-0 font-mono text-[10px]">
                  {s.start.toFixed(1)}s
                </span>
                {s.speaker && (
                  <span className="bg-primary/10 text-primary rounded px-1 py-0.5 text-[10px]">
                    {s.speaker}
                  </span>
                )}
                <span className="flex-1">{s.text}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
