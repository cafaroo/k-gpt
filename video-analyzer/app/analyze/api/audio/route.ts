import { generateObject } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { AUDIO_SYSTEM_PROMPT, AUDIO_USER_PROMPT } from "@/lib/video/audio-prompt";
import { AudioAnalysisSchema } from "@/lib/video/audio-schema";

export const maxDuration = 120;

// Keep the request body modest. Video files can be up to ~100 MB; we POST
// the raw audio here (typically much smaller than the full video).
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "60mb",
    },
  },
};

export async function POST(req: Request) {
  try {
    const buffer = Buffer.from(await req.arrayBuffer());
    const mediaType = req.headers.get("content-type") || "audio/mp4";

    if (buffer.byteLength === 0) {
      return Response.json({ error: "empty body" }, { status: 400 });
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
            {
              type: "file",
              data: buffer,
              mediaType,
            },
          ],
        },
      ],
    });

    return Response.json({ analysis: object });
  } catch (err) {
    console.error("[/analyze/api/audio] failed:", err);
    const message = err instanceof Error ? err.message : "Audio analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
