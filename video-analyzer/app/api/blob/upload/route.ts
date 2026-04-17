import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import type { NextRequest } from "next/server";

/**
 * Mints client-side upload tokens so the browser can PUT the full original
 * video directly to Vercel Blob (public store). Bypasses the 4.5 MB body
 * limit on /api/* and lets the analyze route fetch the URL server-side.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: (pathname: string) => {
        const allowed =
          pathname.startsWith("analysis/video/") ||
          pathname.startsWith("v2/videos/");
        if (!allowed) {
          return Promise.reject(new Error(`Pathname not allowed: ${pathname}`));
        }
        return Promise.resolve({
          allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
          maximumSizeInBytes: 500 * 1024 * 1024,
          tokenPayload: JSON.stringify({ uploadedAt: Date.now() }),
        });
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
