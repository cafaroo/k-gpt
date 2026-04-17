"use client";
import { useCallback, useRef, useState } from "react";

type Props = { onFiles: (files: File[]) => void };

export function Dropzone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("video/")
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragEnter={() => setDragging(true)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`w-full rounded-xl border-2 border-dashed p-16 transition ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      }`}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-lg font-medium">Drop video(s) here</div>
        <div className="text-sm text-muted-foreground">
          or click to browse · MP4 / MOV / WebM · up to 200 MB each
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
        className="hidden"
      />
    </button>
  );
}
