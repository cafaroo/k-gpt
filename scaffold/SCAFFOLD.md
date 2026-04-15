# Video Content Analyzer — Project Scaffold

## Overview
A Next.js app for analyzing short-form video content (TikTok-style, 30s–2min).
Users upload videos, the app extracts visual/audio features client-side using ffmpeg.wasm,
then lets them chat with an LLM about why certain content performs better than others.

**Stack:**
- Next.js 15 (App Router)
- Vercel AI SDK (`ai` package) with `useChat`
- shadcn/ui components
- ffmpeg.wasm for client-side video processing
- Tailwind CSS
- No database needed for POC (all state in memory/session)

**Base template:** `vercel/chatbot` (https://github.com/vercel/chatbot)
Fork it, then apply the changes below.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│                                                  │
│  ┌──────────┐    ┌──────────────┐               │
│  │  Upload   │───▶│  ffmpeg.wasm │               │
│  │  Dropzone │    │  Worker      │               │
│  └──────────┘    └──────┬───────┘               │
│                         │                        │
│            Extracts:    │                        │
│            - frames (jpg, every 2s)              │
│            - scene changes                       │
│            - audio RMS levels                    │
│            - metadata (duration, fps, res)       │
│                         │                        │
│                         ▼                        │
│  ┌──────────────────────────────┐               │
│  │     Analysis Dashboard       │               │
│  │  - Timeline visualization    │               │
│  │  - Frame gallery             │               │
│  │  - Scene change markers      │               │
│  │  - Audio loudness graph      │               │
│  │  - Performance data input    │               │
│  └──────────────┬───────────────┘               │
│                  │                               │
│                  ▼                               │
│  ┌──────────────────────────────┐               │
│  │     Chat Interface           │               │
│  │  useChat + extracted context │               │
│  │  "Why did this video work?"  │               │
│  └──────────────┬───────────────┘               │
│                  │                               │
└──────────────────┼───────────────────────────────┘
                   │ API call (JSON context + frames as base64)
                   ▼
         ┌──────────────────┐
         │  /api/chat        │
         │  AI SDK route     │
         │  Claude/GPT with  │
         │  vision support   │
         └──────────────────┘
```

---

## File Structure (additions/modifications to vercel/chatbot)

```
app/
├── (chat)/                    # existing chatbot routes (keep)
├── analyze/                   # NEW — main analysis flow
│   ├── page.tsx               # Upload + analysis dashboard page
│   └── layout.tsx             # Layout for analyze section
├── api/
│   ├── chat/                  # existing chat route (modify)
│   │   └── route.ts           # Add video analysis system prompt
│   └── analyze/               # NEW — optional server-side processing
│       └── route.ts           # Receives extracted data, returns structured analysis
│
components/
├── video/                     # NEW — all video-related components
│   ├── video-upload.tsx        # Drag & drop upload with preview
│   ├── video-processor.tsx     # ffmpeg.wasm orchestrator component
│   ├── extraction-progress.tsx # Progress bar during extraction
│   ├── analysis-dashboard.tsx  # Main dashboard with all visualizations
│   ├── timeline.tsx            # Timeline bar with scene markers
│   ├── frame-gallery.tsx       # Grid of extracted frames
│   ├── audio-chart.tsx         # Audio loudness over time (recharts)
│   ├── metrics-input.tsx       # Manual input for performance data
│   └── analysis-chat.tsx       # Chat wrapper with video context
│
lib/
├── video/                     # NEW — video processing logic
│   ├── ffmpeg-worker.ts       # ffmpeg.wasm initialization & commands
│   ├── extractors.ts          # Individual extraction functions
│   ├── types.ts               # TypeScript types for all extracted data
│   └── prompts.ts             # System prompts for video analysis
│
hooks/
├── use-video-processor.ts     # NEW — React hook wrapping ffmpeg.wasm
│
public/
├── ffmpeg/                    # ffmpeg.wasm assets (core + wasm files)
```

---

## Key Types (lib/video/types.ts)

```typescript
export interface VideoMetadata {
  filename: string;
  duration: number;        // seconds
  fps: number;
  width: number;
  height: number;
  aspectRatio: string;     // "9:16", "16:9", "1:1"
  fileSize: number;        // bytes
  codec: string;
  bitrate: number;
}

export interface SceneChange {
  timestamp: number;       // seconds
  score: number;           // 0-1 confidence
}

export interface ExtractedFrame {
  timestamp: number;       // seconds
  dataUrl: string;         // base64 jpg
  brightness: number;      // 0-255
  dominantColor: string;   // hex
}

export interface AudioSegment {
  startTime: number;
  endTime: number;
  rmsLevel: number;        // dB
  peak: number;            // dB
  isSilent: boolean;
}

export interface MotionSegment {
  startTime: number;
  endTime: number;
  motionScore: number;     // 0-100
  interpretation: 'low' | 'medium' | 'high';
}

export interface VideoExtraction {
  metadata: VideoMetadata;
  frames: ExtractedFrame[];
  sceneChanges: SceneChange[];
  audioSegments: AudioSegment[];
  motionSegments: MotionSegment[];
  extractedAt: string;     // ISO date
}

export interface PerformanceData {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  completionRate?: number;       // 0-1
  avgWatchTime?: number;         // seconds
  clickThroughRate?: number;     // 0-1
  costPerClick?: number;
  costPerMille?: number;
  platform?: 'tiktok' | 'instagram' | 'youtube_shorts' | 'facebook';
}

export interface VideoAnalysis {
  extraction: VideoExtraction;
  performance?: PerformanceData;
}
```

---

## ffmpeg.wasm Setup (lib/video/ffmpeg-worker.ts)

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export async function initFFmpeg(
  onProgress?: (message: string, progress: number) => void
): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[ffmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress, time }) => {
    onProgress?.(`Processing... ${Math.round(progress * 100)}%`, progress);
  });

  // Load ffmpeg.wasm core
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

export function getFFmpeg(): FFmpeg {
  if (!ffmpeg) throw new Error('FFmpeg not initialized');
  return ffmpeg;
}
```

---

## Extraction Functions (lib/video/extractors.ts)

```typescript
import { getFFmpeg } from './ffmpeg-worker';
import { fetchFile } from '@ffmpeg/util';
import type {
  VideoMetadata, ExtractedFrame, SceneChange,
  AudioSegment, VideoExtraction
} from './types';

export async function extractAll(
  file: File,
  onProgress?: (step: string, progress: number) => void
): Promise<VideoExtraction> {
  const ffmpeg = getFFmpeg();

  // Write input file
  await ffmpeg.writeFile('input.mp4', await fetchFile(file));
  onProgress?.('File loaded', 0.1);

  // 1. Extract metadata via ffprobe-like approach
  const metadata = await extractMetadata(file);
  onProgress?.('Metadata extracted', 0.2);

  // 2. Extract frames every 2 seconds
  const frames = await extractFrames();
  onProgress?.('Frames extracted', 0.5);

  // 3. Detect scene changes
  const sceneChanges = await detectSceneChanges();
  onProgress?.('Scene changes detected', 0.7);

  // 4. Extract audio levels
  const audioSegments = await extractAudioLevels();
  onProgress?.('Audio analyzed', 0.9);

  // 5. Compute motion (from frame differences)
  const motionSegments = computeMotionFromFrames(frames);
  onProgress?.('Analysis complete', 1.0);

  return {
    metadata,
    frames,
    sceneChanges,
    audioSegments,
    motionSegments,
    extractedAt: new Date().toISOString(),
  };
}

async function extractMetadata(file: File): Promise<VideoMetadata> {
  // Use video element to get duration, dimensions
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        filename: file.name,
        duration: video.duration,
        fps: 30, // default, ffmpeg.wasm can't easily get this
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: getAspectRatio(video.videoWidth, video.videoHeight),
        fileSize: file.size,
        codec: 'h264', // default assumption
        bitrate: Math.round((file.size * 8) / video.duration),
      });
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  });
}

async function extractFrames(): Promise<ExtractedFrame[]> {
  const ffmpeg = getFFmpeg();
  const frames: ExtractedFrame[] = [];

  // Extract one frame every 2 seconds
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', 'fps=0.5',
    '-q:v', '4',
    'frame_%04d.jpg'
  ]);

  // Read extracted frames
  let i = 1;
  while (true) {
    const filename = `frame_${String(i).padStart(4, '0')}.jpg`;
    try {
      const data = await ffmpeg.readFile(filename);
      const blob = new Blob([data], { type: 'image/jpeg' });
      const dataUrl = await blobToDataURL(blob);

      // Compute basic stats from image
      const { brightness, dominantColor } = await analyzeFrame(dataUrl);

      frames.push({
        timestamp: (i - 1) * 2,
        dataUrl,
        brightness,
        dominantColor,
      });

      // Cleanup
      await ffmpeg.deleteFile(filename);
      i++;
    } catch {
      break; // No more frames
    }
  }

  return frames;
}

async function detectSceneChanges(): Promise<SceneChange[]> {
  const ffmpeg = getFFmpeg();

  // Use ffmpeg's select filter to detect scene changes
  // Write scene detection output to a log file
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', "select='gt(scene,0.3)',showinfo",
    '-vsync', 'vfr',
    '-f', 'null',
    '-'
  ]);

  // Note: ffmpeg.wasm log parsing is tricky.
  // Alternative: compute scene changes from extracted frame differences
  // This is a simplified version — compare consecutive frames
  return []; // Populated by computeSceneChangesFromFrames() instead
}

async function extractAudioLevels(): Promise<AudioSegment[]> {
  const ffmpeg = getFFmpeg();

  // Extract audio as raw PCM for analysis
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ac', '1',           // mono
    '-ar', '8000',        // 8kHz sample rate (small)
    '-f', 'f32le',        // 32-bit float
    'audio.raw'
  ]);

  try {
    const audioData = await ffmpeg.readFile('audio.raw');
    const float32 = new Float32Array(
      (audioData as Uint8Array).buffer
    );

    // Compute RMS per 1-second bucket
    const sampleRate = 8000;
    const bucketSize = sampleRate; // 1 second
    const segments: AudioSegment[] = [];

    for (let i = 0; i < float32.length; i += bucketSize) {
      const chunk = float32.slice(i, i + bucketSize);
      const rms = Math.sqrt(
        chunk.reduce((sum, val) => sum + val * val, 0) / chunk.length
      );
      const rmsDb = 20 * Math.log10(Math.max(rms, 1e-10));
      const peakDb = 20 * Math.log10(
        Math.max(...Array.from(chunk).map(Math.abs), 1e-10)
      );

      segments.push({
        startTime: i / sampleRate,
        endTime: Math.min((i + bucketSize) / sampleRate, float32.length / sampleRate),
        rmsLevel: rmsDb,
        peak: peakDb,
        isSilent: rmsDb < -40,
      });
    }

    await ffmpeg.deleteFile('audio.raw');
    return segments;
  } catch {
    return [];
  }
}

function computeMotionFromFrames(frames: ExtractedFrame[]) {
  // Compare brightness deltas between consecutive frames
  // as a proxy for motion (real motion needs pixel-level diff)
  return frames.slice(1).map((frame, i) => {
    const prev = frames[i];
    const brightnessDiff = Math.abs(frame.brightness - prev.brightness);
    const motionScore = Math.min(brightnessDiff * 2, 100);

    return {
      startTime: prev.timestamp,
      endTime: frame.timestamp,
      motionScore,
      interpretation: (
        motionScore > 50 ? 'high' :
        motionScore > 25 ? 'medium' : 'low'
      ) as 'low' | 'medium' | 'high',
    };
  });
}

// Helpers
function getAspectRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const d = gcd(w, h);
  return `${w/d}:${h/d}`;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function analyzeFrame(dataUrl: string): Promise<{
  brightness: number;
  dominantColor: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100; // downsample for speed
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 100, 100);
      const imageData = ctx.getImageData(0, 0, 100, 100);
      const data = imageData.data;

      let r = 0, g = 0, b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i+1];
        b += data[i+2];
      }
      const pixels = data.length / 4;
      r = Math.round(r / pixels);
      g = Math.round(g / pixels);
      b = Math.round(b / pixels);

      const brightness = Math.round((r + g + b) / 3);
      const dominantColor = `#${[r,g,b].map(c =>
        c.toString(16).padStart(2, '0')
      ).join('')}`;

      resolve({ brightness, dominantColor });
    };
    img.src = dataUrl;
  });
}
```

---

## System Prompt for Chat (lib/video/prompts.ts)

```typescript
export function buildVideoAnalysisPrompt(
  extraction: VideoExtraction,
  performance?: PerformanceData
): string {
  const { metadata, sceneChanges, audioSegments, motionSegments, frames } = extraction;

  let prompt = `You are a short-form video content analyst specializing in ad performance.
You have been given extracted data from a ${metadata.duration.toFixed(1)}s video
(${metadata.width}x${metadata.height}, ${metadata.aspectRatio}).

## Extracted Data

### Scene Changes (${sceneChanges.length} cuts)
${sceneChanges.map(sc => `- ${sc.timestamp.toFixed(1)}s (score: ${sc.score.toFixed(2)})`).join('\n')}
Average: 1 cut every ${(metadata.duration / Math.max(sceneChanges.length, 1)).toFixed(1)}s

### Motion Analysis
${motionSegments.map(m =>
  `- ${m.startTime}s-${m.endTime}s: ${m.interpretation} (score: ${m.motionScore})`
).join('\n')}

### Audio Levels (per second)
Silent segments: ${audioSegments.filter(a => a.isSilent).length}/${audioSegments.length}
Loudest moment: ${Math.max(...audioSegments.map(a => a.rmsLevel)).toFixed(1)} dB at ${
  audioSegments.reduce((max, a) => a.rmsLevel > max.rmsLevel ? a : max).startTime
}s

### Frame Analysis (sampled every 2s)
${frames.map(f =>
  `- ${f.timestamp}s: brightness=${f.brightness}, color=${f.dominantColor}`
).join('\n')}
`;

  if (performance) {
    prompt += `
## Performance Data
${performance.views ? `Views: ${performance.views.toLocaleString()}` : ''}
${performance.completionRate ? `Completion rate: ${(performance.completionRate * 100).toFixed(1)}%` : ''}
${performance.avgWatchTime ? `Avg watch time: ${performance.avgWatchTime.toFixed(1)}s` : ''}
${performance.likes ? `Likes: ${performance.likes.toLocaleString()}` : ''}
${performance.shares ? `Shares: ${performance.shares.toLocaleString()}` : ''}
${performance.clickThroughRate ? `CTR: ${(performance.clickThroughRate * 100).toFixed(2)}%` : ''}
${performance.costPerClick ? `CPC: $${performance.costPerClick.toFixed(2)}` : ''}
${performance.platform ? `Platform: ${performance.platform}` : ''}
`;
  }

  prompt += `
## Your Role
Analyze this video's content structure and predict/explain its performance.
Focus on:
1. Hook effectiveness (first 3 seconds)
2. Pacing and scene change rhythm
3. Audio dynamics (music, voiceover, silence)
4. Visual variety and engagement patterns
5. Narrative arc (problem→solution, storytelling, etc.)

When frames are provided as images, also analyze:
- Text overlays and captions
- Face presence and framing
- Product placement and branding
- Visual style and production quality
- CTA placement and design

Be specific and actionable. Reference exact timestamps.
If performance data is provided, correlate visual features with metrics.
`;

  return prompt;
}
```

---

## Chat Route Modification (app/api/chat/route.ts)

The existing chat route needs to be modified to:
1. Accept a `videoContext` field in the request body
2. Prepend the video analysis system prompt
3. Support vision (sending frames as images in the message)

```typescript
// In the chat route handler, add:
import { buildVideoAnalysisPrompt } from '@/lib/video/prompts';

// When videoContext is present in the request:
const systemPrompt = videoContext
  ? buildVideoAnalysisPrompt(videoContext.extraction, videoContext.performance)
  : defaultSystemPrompt;

// For vision support, include key frames as image parts in the first message:
const frameImages = videoContext?.extraction.frames
  .filter((_, i) => i % 3 === 0) // Every 6th second (every 3rd frame)
  .slice(0, 8) // Max 8 frames to stay within context
  .map(f => ({
    type: 'image' as const,
    image: f.dataUrl,
  }));
```

---

## React Hook (hooks/use-video-processor.ts)

```typescript
'use client';

import { useState, useCallback } from 'react';
import type { VideoExtraction } from '@/lib/video/types';

type ProcessingState = 'idle' | 'loading' | 'extracting' | 'done' | 'error';

export function useVideoProcessor() {
  const [state, setState] = useState<ProcessingState>('idle');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [extraction, setExtraction] = useState<VideoExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processVideo = useCallback(async (file: File) => {
    try {
      setState('loading');
      setStep('Loading ffmpeg...');
      setProgress(0);

      // Dynamic import to avoid SSR issues
      const { initFFmpeg } = await import('@/lib/video/ffmpeg-worker');
      await initFFmpeg((msg, p) => {
        setStep(msg);
        setProgress(p * 0.1); // 10% for loading
      });

      setState('extracting');
      const { extractAll } = await import('@/lib/video/extractors');
      const result = await extractAll(file, (stepName, p) => {
        setStep(stepName);
        setProgress(0.1 + p * 0.9); // 10-100%
      });

      setExtraction(result);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setStep('');
    setExtraction(null);
    setError(null);
  }, []);

  return { state, progress, step, extraction, error, processVideo, reset };
}
```

---

## Dependencies to Add

```json
{
  "@ffmpeg/ffmpeg": "^0.12.10",
  "@ffmpeg/util": "^0.12.1",
  "recharts": "^2.12.0"
}
```

Also ensure `next.config.ts` has:
```javascript
// Required for ffmpeg.wasm SharedArrayBuffer support
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    },
  ];
},
```

⚠️ **IMPORTANT**: These COOP/COEP headers can break third-party embeds
and OAuth flows. For the POC this is fine, but in production you'd want
to scope them to just the `/analyze` route or use a service worker approach.

---

## UI Flow

### Step 1: Upload
- Drag & drop or click to upload video (max 100MB for POC)
- Show video preview in `<video>` element
- "Analyze" button triggers processing

### Step 2: Processing
- Show progress bar with current step name
- Steps: Loading ffmpeg → Extracting frames → Detecting scenes →
  Analyzing audio → Computing motion → Done

### Step 3: Dashboard
- **Top bar**: Video metadata (duration, resolution, file size)
- **Timeline**: Horizontal bar showing full video duration
  - Scene change markers (vertical lines)
  - Color-coded motion intensity regions
  - Audio waveform overlay
- **Frame Gallery**: Grid of extracted frames, clickable to expand
- **Metrics Panel**: Optional — input fields for performance data
  (views, completion rate, CTR, etc.)
- **"Chat about this video" button** → opens chat with full context

### Step 4: Chat
- Pre-loaded with extraction data as system context
- First message automatically includes key frames as images
- User can ask:
  - "Why does this video perform well/poorly?"
  - "What's the hook strategy?"
  - "How could the pacing be improved?"
  - "Compare this to best practices for TikTok ads"

---

## Environment Variables Needed

```env
# AI provider (via Vercel AI Gateway or direct)
OPENAI_API_KEY=          # or
ANTHROPIC_API_KEY=       # Claude with vision support

# Optional: Vercel AI Gateway (if using vercel/chatbot template)
AI_GATEWAY_API_KEY=
```

---

## Claude Code Instructions

When building this project:

1. **Start from `vercel/chatbot` template**:
   ```bash
   npx create-next-app --example https://github.com/vercel/chatbot video-analyzer
   ```

2. **Install additional dependencies**:
   ```bash
   npm install @ffmpeg/ffmpeg @ffmpeg/util recharts
   ```

3. **Build in this order**:
   - Types first (`lib/video/types.ts`)
   - ffmpeg worker (`lib/video/ffmpeg-worker.ts`)
   - Extractors (`lib/video/extractors.ts`)
   - React hook (`hooks/use-video-processor.ts`)
   - Upload component (`components/video/video-upload.tsx`)
   - Progress component (`components/video/extraction-progress.tsx`)
   - Dashboard components (timeline, frame gallery, audio chart)
   - Chat integration (modify existing chat route)
   - Wire it all together in `app/analyze/page.tsx`

4. **Test with**: The example video is a 88s RYZE Mushroom Coffee UGC ad,
   720x1280 (9:16), 30fps, ~13MB. It has:
   - 25 scene changes
   - Text overlays throughout
   - Face-on-camera segments
   - Product shots
   - 3D animation insert
   - Clear problem→solution→CTA narrative arc
