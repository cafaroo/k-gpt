import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "./ffmpeg-worker";
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
  const ffmpeg = getFFmpeg();

  console.log("[extract] writing file", file.name, file.size);
  await ffmpeg.writeFile("input.mp4", await fetchFile(file));
  onProgress?.("File loaded", 0.1);

  console.log("[extract] reading metadata");
  const metadata = await extractMetadata(file);
  onProgress?.("Metadata extracted", 0.2);

  let frames: ExtractedFrame[] = [];
  try {
    console.log("[extract] extracting frames");
    frames = await extractFrames();
  } catch (err) {
    console.error("[extract] frame extraction failed:", err);
    throw new Error(
      `Frame extraction failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  onProgress?.("Frames extracted", 0.55);

  console.log("[extract] analyzing", frames.length, "frames");
  for (const frame of frames) {
    try {
      frame.gray32 = await decodeToGray32(frame.dataUrl);
    } catch (err) {
      console.warn("[extract] gray32 failed for frame", frame.timestamp, err);
    }
  }
  const { motion, scenes } = computeMotionAndScenes(frames);
  onProgress?.("Motion & scenes analyzed", 0.8);

  console.log("[extract] extracting audio");
  const audioSegments = await extractAudioRMS();
  onProgress?.("Audio analyzed", 0.95);

  try {
    await ffmpeg.deleteFile("input.mp4");
  } catch {
    // ignore cleanup failures
  }

  onProgress?.("Ready", 1);

  return {
    metadata,
    frames,
    sceneChanges: scenes,
    audioSegments,
    motionSegments: motion,
    extractedAt: new Date().toISOString(),
  };
}

function extractMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const { videoWidth: w, videoHeight: h, duration } = video;
      resolve({
        filename: file.name,
        duration,
        fps: 30,
        width: w,
        height: h,
        aspectRatio: getAspectRatio(w, h),
        fileSize: file.size,
        codec: file.type || "video/mp4",
        bitrate: duration > 0 ? Math.round((file.size * 8) / duration) : 0,
      });
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => reject(new Error("Failed to load video metadata"));
    video.src = URL.createObjectURL(file);
  });
}

async function extractFrames(): Promise<ExtractedFrame[]> {
  const ffmpeg = getFFmpeg();
  // Output at ~240px wide to keep wasm heap usage low.
  await ffmpeg.exec([
    "-i",
    "input.mp4",
    "-vf",
    "fps=1,scale=240:-2:flags=fast_bilinear",
    "-q:v",
    "7",
    "-an",
    "frame_%04d.jpg",
  ]);

  const frames: ExtractedFrame[] = [];
  let i = 1;
  while (true) {
    const filename = `frame_${String(i).padStart(4, "0")}.jpg`;
    try {
      const data = await ffmpeg.readFile(filename);
      const bytes = data as Uint8Array;
      if (!bytes || bytes.length === 0) {
        break;
      }
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const dataUrl = await blobToDataURL(blob);
      const { brightness, dominantColor } = await analyzeFrameColor(dataUrl);
      frames.push({
        timestamp: i - 1,
        dataUrl,
        brightness,
        dominantColor,
      });
      try {
        await ffmpeg.deleteFile(filename);
      } catch {
        // ignore
      }
      i++;
    } catch {
      break;
    }
  }
  return frames;
}

async function extractAudioRMS(): Promise<AudioSegment[]> {
  const ffmpeg = getFFmpeg();
  const sampleRate = 16_000; // lower rate → smaller wasm buffer
  try {
    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "s16le", // 16-bit PCM is half the size of f32le
      "-acodec",
      "pcm_s16le",
      "audio.raw",
    ]);
    const audioData = await ffmpeg.readFile("audio.raw");
    const bytes = audioData as Uint8Array;
    if (!bytes || bytes.length < 2) {
      return [];
    }

    // Int16 LE → normalized Float32 (-1..1)
    const int16 = new Int16Array(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + (bytes.byteLength & ~1)
      )
    );

    const bucketSize = Math.floor(sampleRate * 0.1);
    const segments: AudioSegment[] = [];
    for (let i = 0; i < int16.length; i += bucketSize) {
      const end = Math.min(i + bucketSize, int16.length);
      let sumSq = 0;
      let peak = 0;
      for (let j = i; j < end; j++) {
        const v = int16[j] / 32_768;
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
    try {
      await ffmpeg.deleteFile("audio.raw");
    } catch {
      // ignore
    }
    return segments;
  } catch (err) {
    console.warn("[extract] audio extraction failed:", err);
    return [];
  }
}

function getAspectRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const d = gcd(w, h) || 1;
  return `${w / d}:${h / d}`;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function analyzeFrameColor(
  dataUrl: string
): Promise<{ brightness: number; dominantColor: string }> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { brightness: 0, dominantColor: "#000000" };
  }
  ctx.drawImage(img, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
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
