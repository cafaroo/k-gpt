"use client";

import type { ExtractedFrame } from "@/lib/video/types";

type Props = {
  frames: ExtractedFrame[];
  currentTime: number;
  onSeek: (time: number) => void;
};

export function FrameGallery({ frames, currentTime, onSeek }: Props) {
  if (frames.length === 0) return null;
  return (
    <div className="flex w-full gap-1 overflow-x-auto pb-2">
      {frames.map((f) => {
        const active = Math.abs(f.timestamp - currentTime) < 0.5;
        return (
          <button
            className={`relative shrink-0 overflow-hidden rounded-md transition-all ${
              active ? "ring-primary ring-2" : "opacity-70 hover:opacity-100"
            }`}
            key={f.timestamp}
            onClick={() => onSeek(f.timestamp)}
            style={{ width: 80 }}
            type="button"
          >
            <img
              alt={`frame at ${f.timestamp}s`}
              className="h-14 w-20 object-cover"
              src={f.dataUrl}
            />
            <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[10px] text-white">
              {f.timestamp}s
            </span>
          </button>
        );
      })}
    </div>
  );
}
