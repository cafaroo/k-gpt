"use client";

import { useCallback } from "react";
import { AudioLandscapeV2 } from "@/components/video/v2/audio-landscape-v2";
import { BeatMapTimeline } from "@/components/video/v2/beat-map-timeline";
import { EmotionalFlowDiagram } from "@/components/video/v2/emotional-flow-diagram";
import { ScenesTimeline } from "@/components/video/v2/scenes-timeline";
import { TranscriptPanel } from "@/components/video/v2/transcript-panel";
import { VideoWithOverlay } from "@/components/video/v2/video-with-overlay";

// Seek approach: document.querySelector — no videoRef lift required.
// VideoWithOverlay owns its own ref internally; seeking is done here by querying
// the first <video> element on the page. Simple and POC-acceptable; if multiple
// videos were on the page we'd need the lifted-ref approach.
function seekVideo(time: number) {
  const video = document.querySelector<HTMLVideoElement>("video");
  if (video) {
    video.currentTime = time;
    video.play().catch(() => {
      /* user hasn't interacted yet — fine */
    });
  }
}

type VideoRow = {
  blobUrl: string;
  filename?: string;
  durationSec?: string | number | null;
};

type Props = {
  // biome-ignore lint/suspicious/noExplicitAny: flexible payload
  fullPayload: any;
  video: VideoRow;
};

export function PerVideoClient({ fullPayload, video }: Props) {
  const onSeek = useCallback((time: number) => seekVideo(time), []);
  const totalDuration = Number(video.durationSec ?? 0);

  return (
    <div className="space-y-6">
      {/* Video player with live overlay (owns its own ref) */}
      <VideoWithOverlay fullPayload={fullPayload} video={video} />

      {/* Beat map */}
      {fullPayload?.beatMap && (
        <BeatMapTimeline
          beatMap={fullPayload.beatMap}
          onSeek={onSeek}
          totalDuration={totalDuration}
        />
      )}

      {/* Scenes timeline */}
      {fullPayload?.scenes && (
        <ScenesTimeline
          onSeek={onSeek}
          scenes={fullPayload.scenes}
          totalDuration={totalDuration}
        />
      )}

      {/* Emotional flow */}
      <EmotionalFlowDiagram
        matched={fullPayload?.researchMeta?.bigram?.matched ?? []}
        matchScore={fullPayload?.extended?.emotionalFlowMatchScore ?? 0}
        rationale={fullPayload?.researchMeta?.bigram?.rationale}
        sequence={fullPayload?.extended?.emotionalFlowSequence ?? []}
      />

      {/* Transcript */}
      <TranscriptPanel
        onSeek={onSeek}
        transcript={fullPayload?.extended?.transcript}
      />

      {/* Audio landscape v2 */}
      {fullPayload?.extended?.audioExtended && (
        <AudioLandscapeV2
          audioExtended={fullPayload.extended.audioExtended}
          totalDuration={totalDuration}
          onSeek={onSeek}
        />
      )}
    </div>
  );
}
