"use client";

import { FileSpreadsheet, Film, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Batch } from "@/lib/video/batch/types";

const MAX_FILE = 100 * 1024 * 1024;

type Props = {
  batch: Batch;
  hasCsv: boolean;
  onAddVideos: (files: File[]) => void;
  onRemoveVideo: (id: string) => void;
  onAttachCsv: (file: File) => void;
  onStart: () => void;
  error: string | null;
};

export function BatchUpload({
  batch,
  hasCsv,
  onAddVideos,
  onRemoveVideo,
  onAttachCsv,
  onStart,
  error,
}: Props) {
  const [dragging, setDragging] = useState<"video" | "csv" | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const videos = arr.filter(
        (f) => f.type.startsWith("video/") && f.size <= MAX_FILE
      );
      if (videos.length > 0) {
        onAddVideos(videos);
      }
    },
    [onAddVideos]
  );

  const canStart = batch.videos.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Batch analysis</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Upload N short-form videos plus optional performance CSV. Qwen +
          Gemini run in parallel, you get a leaderboard, pattern-finder
          insights, and drill-down into every clip.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,280px)]">
        {/* Video dropzone */}
        <button
          className={`group flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
            dragging === "video"
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/40"
          }`}
          onClick={() => videoInput.current?.click()}
          onDragLeave={() => setDragging(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging("video");
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(null);
            accept(e.dataTransfer.files);
          }}
          type="button"
        >
          <div className="bg-primary/10 group-hover:bg-primary/20 mb-3 rounded-full p-3 transition-colors">
            <UploadCloud className="text-primary h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold">Drop videos or click</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            MP4/MOV/WebM · up to 100 MB each · 1 to many
          </p>
          <input
            accept="video/*"
            className="hidden"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                accept(e.target.files);
              }
            }}
            ref={videoInput}
            type="file"
          />
        </button>

        {/* CSV dropzone */}
        <button
          className={`flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center text-sm transition-all ${
            dragging === "csv"
              ? "border-primary bg-primary/5"
              : hasCsv
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/40"
          }`}
          onClick={() => csvInput.current?.click()}
          onDragLeave={() => setDragging(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging("csv");
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(null);
            const f = e.dataTransfer.files?.[0];
            if (f) {
              onAttachCsv(f);
            }
          }}
          type="button"
        >
          <FileSpreadsheet
            className={`mb-2 h-7 w-7 ${hasCsv ? "text-emerald-500" : "text-muted-foreground"}`}
          />
          <span className="font-medium">
            {hasCsv ? "Performance CSV loaded" : "Drop performance CSV"}
          </span>
          <span className="text-muted-foreground mt-1 text-xs">
            (optional) views, CTR, saves…
          </span>
          <input
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onAttachCsv(f);
              }
            }}
            ref={csvInput}
            type="file"
          />
        </button>
      </div>

      {/* Video list */}
      {batch.videos.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {batch.videos.length} video{batch.videos.length === 1 ? "" : "s"}{" "}
              queued
            </span>
            <Button disabled={!canStart} onClick={onStart} size="sm">
              Start batch analysis →
            </Button>
          </div>
          <ul className="divide-y">
            {batch.videos.map((v) => (
              <li className="flex items-center gap-3 py-2 text-sm" key={v.id}>
                <Film className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{v.filename}</span>
                <span className="text-muted-foreground text-xs">
                  {(v.file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                {v.performance && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    perf ✓
                  </span>
                )}
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveVideo(v.id)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {error && (
        <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
