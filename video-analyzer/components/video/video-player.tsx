"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type VideoPlayerHandle = {
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
};

type Props = {
  src: string;
  onTimeUpdate?: (time: number) => void;
  onDuration?: (duration: number) => void;
};

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  function VideoPlayer({ src, onTimeUpdate, onDuration }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
        }
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
    }));

    useEffect(() => {
      const v = videoRef.current;
      if (!v) {
        return;
      }
      const time = () => onTimeUpdate?.(v.currentTime);
      const dur = () => onDuration?.(v.duration);
      v.addEventListener("timeupdate", time);
      v.addEventListener("loadedmetadata", dur);
      return () => {
        v.removeEventListener("timeupdate", time);
        v.removeEventListener("loadedmetadata", dur);
      };
    }, [onTimeUpdate, onDuration]);

    return (
      <div className="bg-muted w-full overflow-hidden rounded-xl">
        {src ? (
          <video
            className="h-auto w-full"
            controls
            playsInline
            ref={videoRef}
            src={src}
          >
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        )}
      </div>
    );
  }
);
