import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

export async function initFFmpeg(
  onProgress?: (message: string, progress: number) => void
): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading;

  loading = (async () => {
    const instance = new FFmpeg();

    instance.on("log", ({ message }) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[ffmpeg]", message);
      }
    });

    instance.on("progress", ({ progress }) => {
      onProgress?.(
        `Processing... ${Math.round(progress * 100)}%`,
        Math.max(0, Math.min(1, progress))
      );
    });

    await instance.load({
      coreURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.js`,
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpeg = instance;
    return instance;
  })();

  return loading;
}

export function getFFmpeg(): FFmpeg {
  if (!ffmpeg)
    throw new Error("FFmpeg not initialized — call initFFmpeg first");
  return ffmpeg;
}
