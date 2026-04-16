"use client";

import { upload } from "@vercel/blob/client";

/**
 * Browser-side helper that streams the original video to Vercel Blob via a
 * signed upload token minted by /api/blob/upload, then returns the public
 * blob URL so the analyze route can fetch bytes and forward them to Gemini.
 */

const TOKEN_ENDPOINT = "/api/blob/upload";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function uploadVideo(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `analysis/video/${uid()}.${ext}`;
  const { url } = await upload(path, file, {
    access: "public",
    handleUploadUrl: TOKEN_ENDPOINT,
    contentType: file.type || "video/mp4",
  });
  return url;
}
