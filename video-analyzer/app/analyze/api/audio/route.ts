import { generateObject } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  AUDIO_SYSTEM_PROMPT,
  AUDIO_USER_PROMPT,
} from "@/lib/video/audio-prompt";
import { AudioAnalysisSchema } from "@/lib/video/audio-schema";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let buffer: Buffer;
    let mediaType: string;

    if (contentType.includes("application/json")) {
      // Blob-URL path (Phase 2 persistence).
      const { audioUrl } = (await req.json()) as { audioUrl: string };
      if (!audioUrl) {
        return Response.json({ error: "audioUrl required" }, { status: 400 });
      }
      const fetched = await fetch(audioUrl);
      if (!fetched.ok) {
        return Response.json(
          { error: `failed to fetch audio (HTTP ${fetched.status})` },
          { status: 400 }
        );
      }
      buffer = Buffer.from(await fetched.arrayBuffer());
      mediaType = fetched.headers.get("content-type") || "audio/wav";
    } else {
      // Inline binary body path.
      buffer = Buffer.from(await req.arrayBuffer());
      mediaType = contentType || "audio/wav";
    }

    if (buffer.byteLength === 0) {
      return Response.json({ error: "empty audio" }, { status: 400 });
    }

    const { object } = await generateObject({
      model: getLanguageModel("google/gemini-3-flash"),
      schema: AudioAnalysisSchema,
      system: AUDIO_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: AUDIO_USER_PROMPT },
            { type: "file", data: buffer, mediaType },
          ],
        },
      ],
    });

    return Response.json({ analysis: object });
  } catch (err) {
    console.error("[/analyze/api/audio] failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Audio analysis failed" },
      { status: 500 }
    );
  }
}
