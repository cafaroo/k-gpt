import { computeMotionAndScenes, decodeToGray32 } from "./frame-analysis";
import type {
  AudioSegment,
  ExtractedFrame,
  VideoExtraction,
  VideoMetadata,
} from "./types";

export async function extractAll(
  file: File,
  onProgress?: (step: string, progress: number) => void
): Promise<VideoExtraction> {
  onProgress?.("Loading video", 0.05);
  const blobUrl = URL.createObjectURL(file);

  try {
    console.log("[extract] reading metadata");
    const { metadata, videoEl } = await loadVideo(file, blobUrl);
    onProgress?.("Metadata extracted", 0.15);

    console.log("[extract] extracting frames via canvas");
    const frames = await extractFramesFromVideo(videoEl, metadata.duration, (p) => {
      onProgress?.("Extracting frames", 0.15 + p * 0.45);
    });

    console.log("[extract] analyzing", frames.length, "frames");
    for (const frame of frames) {
      try {
        frame.gray32 = await decodeToGray32(frame.dataUrl);
      } catch (err) {
        console.warn("[extract] gray32 failed for frame", frame.timestamp, err);
      }
    }
    const { motion, scenes } = computeMotionAndScenes(frames);
    onProgress?.("Motion & scenes analyzed", 0.75);

    console.log("[extract] extracting audio via WebAudio");
    const audioSegments = await extractAudioViaWebAudio(file);
    onProgress?.("Audio analyzed", 0.95);

    videoEl.remove();
    onProgress?.("Ready", 1);

    return {
      metadata,
      frames,
      sceneChanges: scenes,
      audioSegments,
      motionSegments: motion,
      extractedAt: new Date().toISOString(),
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function loadVideo(
  file: File,
  blobUrl: string
): Promise<{ metadata: VideoMetadata; videoEl: HTMLVideoElement }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = blobUrl;

    video.onloadedmetadata = () => {
      const { videoWidth: w, videoHeight: h, duration } = video;
      resolve({
        metadata: {
          filename: file.name,
          duration,
          fps: 30,
          width: w,
          height: h,
          aspectRatio: getAspectRatio(w, h),
          fileSize: file.size,
          codec: file.type || "video/mp4",
          bitrate: duration > 0 ? Math.round((file.size * 8) / duration) : 0,
        },
        videoEl: video,
      });
    };
    video.onerror = () => reject(new Error("Failed to load video metadata"));
  });
}

async function extractFramesFromVideo(
  video: HTMLVideoElement,
  duration: number,
  onProgress: (p: number) => void
): Promise<ExtractedFrame[]> {
  const targetWidth = 240;
  const aspectRatio = video.videoHeight / video.videoWidth;
  const targetHeight = Math.round(targetWidth * aspectRatio);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  const frameCount = Math.max(2, Math.floor(duration));
  const frames: ExtractedFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t = Math.min(i, duration - 0.01);
    await seekVideo(video, t);
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    const { brightness, dominantColor } = sampleColorFromContext(ctx, targetWidth, targetHeight);
    frames.push({
      timestamp: t,
      dataUrl,
      brightness,
      dominantColor,
    });
    onProgress(i / frameCount);
  }

  return frames;
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      // Give the browser a tick to actually paint the frame
      requestAnimationFrame(() => resolve());
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error(`Seek failed at ${time}s`));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

function sampleColorFromContext(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): { brightness: number; dominantColor: string } {
  // Sample a 64x64 area for speed
  const sampleSize = Math.min(64, w);
  const sx = Math.floor((w - sampleSize) / 2);
  const sy = Math.floor((h - sampleSize) / 2);
  const { data } = ctx.getImageData(sx, sy, sampleSize, sampleSize);
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r = Math.round(r / pixels);
  g = Math.round(g / pixels);
  b = Math.round(b / pixels);
  const brightness = Math.round((r + g + b) / 3);
  const hex = `#${[r, g, b]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
  return { brightness, dominantColor: hex };
}

async function extractAudioViaWebAudio(file: File): Promise<AudioSegment[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // biome-ignore lint/suspicious/noExplicitAny: webkit fallback
    const AudioCtx: typeof AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return [];
    }
    const audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    audioCtx.close();

    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const bucketSize = Math.floor(sampleRate * 0.1);
    const segments: AudioSegment[] = [];

    for (let i = 0; i < channel.length; i += bucketSize) {
      const end = Math.min(i + bucketSize, channel.length);
      let sumSq = 0;
      let peak = 0;
      for (let j = i; j < end; j++) {
        const v = channel[j];
        sumSq += v * v;
        const abs = Math.abs(v);
        if (abs > peak) {
          peak = abs;
        }
      }
      const rms = Math.sqrt(sumSq / Math.max(1, end - i));
      const rmsDb = 20 * Math.log10(Math.max(rms, 1e-10));
      const peakDb = 20 * Math.log10(Math.max(peak, 1e-10));
      segments.push({
        startTime: i / sampleRate,
        endTime: end / sampleRate,
        rmsLevel: rmsDb,
        peak: peakDb,
        isSilent: rmsDb < -40,
      });
    }
    return segments;
  } catch (err) {
    console.warn("[extract] audio decoding failed:", err);
    return [];
  }
}

function getAspectRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const d = gcd(w, h) || 1;
  return `${w / d}:${h / d}`;
}
