"use client";

import { UploadCloud, Video } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onFile: (file: File) => void;
};

const MAX_SIZE = 100 * 1024 * 1024;
const SAMPLE_URL = "/samples/ugc-sample.mp4";

export function VideoUpload({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith("video/")) {
        setError("Please select a video file.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("File too large (max 100 MB).");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        accept(file);
      }
    },
    [accept]
  );

  const loadSample = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) {
        throw new Error("Sample video not found");
      }
      const blob = await res.blob();
      const file = new File([blob], "ugc-sample.mp4", {
        type: blob.type || "video/mp4",
      });
      onFile(file);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load sample video"
      );
    }
  }, [onFile]);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      <button
        className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/40"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
        type="button"
      >
        <div className="bg-primary/10 group-hover:bg-primary/20 mb-4 rounded-full p-4 transition-colors">
          <UploadCloud className="text-primary h-10 w-10" />
        </div>
        <h2 className="text-xl font-semibold">
          Drop a video or click to upload
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          MP4, MOV, WebM · up to 100 MB · 30s–2min recommended
        </p>
        <input
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              accept(file);
            }
          }}
          ref={inputRef}
          type="file"
        />
      </button>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">or</span>
        <Button onClick={loadSample} size="sm" variant="link">
          <Video className="mr-1 h-4 w-4" />
          Try sample video
        </Button>
      </div>

      {error && (
        <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
