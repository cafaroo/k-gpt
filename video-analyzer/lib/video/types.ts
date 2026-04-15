export interface VideoMetadata {
  filename: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  aspectRatio: string;
  fileSize: number;
  codec: string;
  bitrate: number;
}

export interface SceneChange {
  timestamp: number;
  score: number;
}

export interface ExtractedFrame {
  timestamp: number;
  dataUrl: string;
  brightness: number;
  dominantColor: string;
  gray32?: Uint8ClampedArray;
}

export interface AudioSegment {
  startTime: number;
  endTime: number;
  rmsLevel: number;
  peak: number;
  isSilent: boolean;
}

export interface MotionSegment {
  startTime: number;
  endTime: number;
  motionScore: number;
  interpretation: "low" | "medium" | "high";
}

export interface VideoExtraction {
  metadata: VideoMetadata;
  frames: ExtractedFrame[];
  sceneChanges: SceneChange[];
  audioSegments: AudioSegment[];
  motionSegments: MotionSegment[];
  extractedAt: string;
}

export interface PerformanceData {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  completionRate?: number;
  avgWatchTime?: number;
  clickThroughRate?: number;
  costPerClick?: number;
  costPerMille?: number;
  platform?: "tiktok" | "instagram" | "youtube_shorts" | "facebook";
}

export interface VideoAnalysis {
  extraction: VideoExtraction;
  performance?: PerformanceData;
}

export type ProcessingState =
  | "idle"
  | "loading"
  | "extracting"
  | "done"
  | "error";

export interface ExportChartRefs {
  [name: string]: HTMLElement | null;
}
