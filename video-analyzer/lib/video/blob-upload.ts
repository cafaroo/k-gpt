"use client";

import { upload } from "@vercel/blob/client";
import type { ExtractedFrame } from "./types";

/**
 * Browser-side helpers that stream large payloads to Vercel Blob via signed
 * upload tokens minted by /api/blob/upload, then return the public blob URL
 * so server routes can fetch the data instead of receiving it inline (which
 * would hit the 4.5 MB Vercel function body limit).
 */

const TOKEN_ENDPOINT = "/api/blob/upload";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function uploadAudioWav(blob: Blob): Promise<string> {
  const path = `analysis/audio/${uid()}.wav`;
  const { url } = await upload(path, blob, {
    access: "public",
    handleUploadUrl: TOKEN_ENDPOINT,
    contentType: blob.type || "audio/wav",
  });
  return url;
}

export type FramesBundle = {
  version: 1;
  frames: { timestamp: number; dataUrl: string }[];
};

export async function uploadFramesBundle(
  frames: ExtractedFrame[]
): Promise<string> {
  const bundle: FramesBundle = {
    version: 1,
    frames: frames.map((f) => ({
      timestamp: f.timestamp,
      dataUrl: f.dataUrl,
    })),
  };
  const json = JSON.stringify(bundle);
  const file = new Blob([json], { type: "application/json" });
  const path = `analysis/frames/${uid()}.json`;
  const { url } = await upload(path, file, {
    access: "public",
    handleUploadUrl: TOKEN_ENDPOINT,
    contentType: "application/json",
  });
  return url;
}
