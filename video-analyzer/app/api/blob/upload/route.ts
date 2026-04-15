import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import type { NextRequest } from "next/server";

/**
 * Mints client-side upload tokens so the browser can PUT directly to
 * Vercel Blob without going through this serverless function. Bypasses the
 * 4.5 MB body limit on /api/* and lets us upload audio + frame bundles.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: (pathname: string) => {
        const allowed =
          pathname.startsWith("analysis/audio/") ||
          pathname.startsWith("analysis/frames/");
        if (!allowed) {
          return Promise.reject(new Error(`Pathname not allowed: ${pathname}`));
        }
        return Promise.resolve({
          allowedContentTypes: ["audio/wav", "audio/x-wav", "application/json"],
          maximumSizeInBytes: 80 * 1024 * 1024,
          tokenPayload: JSON.stringify({ uploadedAt: Date.now() }),
        });
      },
      onUploadCompleted: ({ blob }) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[blob/upload] completed", blob.pathname, blob.url);
        }
        return Promise.resolve();
      },
    });
    return Response.json(json);
  } catch (err) {
    console.error("[blob/upload] failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "upload failed" },
      { status: 400 }
    );
  }
}
