"use client";

import { type MouseEvent, useMemo, useRef } from "react";
import type { VideoExtraction } from "@/lib/video/types";

type Props = {
  extraction: VideoExtraction;
  currentTime: number;
  onSeek: (time: number) => void;
  onElementReady?: (el: HTMLDivElement | null) => void;
};

export function Timeline({
  extraction,
  currentTime,
  onSeek,
  onElementReady,
}: Props) {
  const { metadata, sceneChanges, motionSegments, audioSegments } = extraction;
  const duration = metadata.duration || 1;
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const maxRms = useMemo(() => {
    const top = audioSegments.reduce(
      (max, a) => Math.max(max, a.rmsLevel),
      -80
    );
    const bottom = audioSegments.reduce(
      (min, a) => Math.min(min, a.rmsLevel),
      0
    );
    return { top, bottom };
  }, [audioSegments]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const target = wrapperRef.current ?? e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(duration, t)));
  };

  const playheadPct = Math.min(100, (currentTime / duration) * 100);

  return (
    <div
      className="bg-muted/40 relative w-full overflow-hidden rounded-lg border"
      ref={(el) => {
        wrapperRef.current = el;
        onElementReady?.(el);
      }}
      style={{ height: 84 }}
    >
      <div className="absolute inset-x-0 top-0 flex h-10 items-end">
        {audioSegments.map((seg) => {
          const range = Math.max(1, maxRms.top - maxRms.bottom);
          const h = Math.max(2, ((seg.rmsLevel - maxRms.bottom) / range) * 40);
          return (
            <div
              className="bg-primary/25"
              key={`${seg.startTime}-audio`}
              style={{
                height: `${h}px`,
                width: `${(1 / audioSegments.length) * 100}%`,
              }}
            />
          );
        })}
      </div>

      <div className="absolute inset-x-0 flex h-3" style={{ top: 44 }}>
        {motionSegments.map((seg) => {
          const intensity = seg.motionScore / 100;
          return (
            <div
              key={`${seg.startTime}-motion`}
              style={{
                width: `${((seg.endTime - seg.startTime) / duration) * 100}%`,
                backgroundColor: `rgba(239, 68, 68, ${0.15 + intensity * 0.7})`,
              }}
            />
          );
        })}
      </div>

      {sceneChanges.map((sc) => (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
          key={sc.timestamp}
          style={{ left: `${(sc.timestamp / duration) * 100}%` }}
          title={`Scene @ ${sc.timestamp.toFixed(1)}s`}
        />
      ))}

      <div className="text-muted-foreground absolute inset-x-0 bottom-0 flex h-5 select-none items-center justify-between px-2 text-[10px]">
        <span>0s</span>
        <span>{duration.toFixed(1)}s</span>
      </div>

      <div
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ left: `${playheadPct}%` }}
      />

      <button
        aria-label="Seek"
        className="absolute inset-0 cursor-col-resize"
        onClick={handleClick}
        type="button"
      />
    </div>
  );
}
