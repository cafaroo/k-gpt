import { generateObject } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  buildQwenUserMessage,
  QWEN_SYSTEM_PROMPT,
} from "@/lib/video/qwen-prompt";
import { QwenAnalysisSchema } from "@/lib/video/qwen-schema";
import type { VideoExtraction } from "@/lib/video/types";

export const maxDuration = 120;

type RequestBody = {
  extraction: VideoExtraction;
  frameDataUrls: string[];
  modelId?: string;
};

export async function POST(req: Request) {
  const { extraction, frameDataUrls, modelId } =
    (await req.json()) as RequestBody;

  if (!extraction || !frameDataUrls || frameDataUrls.length === 0) {
    return Response.json(
      { error: "extraction and frameDataUrls required" },
      { status: 400 }
    );
  }

  const { metadataText, audioText, motionText } =
    buildQwenUserMessage(extraction);

  const textBlock = [
    metadataText,
    "",
    audioText,
    "",
    motionText,
    "",
    "Keyframes (chronological, 1 per second) attached below.",
  ].join("\n");

  const imageParts = frameDataUrls.map((url) => ({
    type: "image" as const,
    image: url,
  }));

  try {
    const { object } = await generateObject({
      model: getLanguageModel(modelId ?? "alibaba/qwen3-vl-thinking"),
      schema: QwenAnalysisSchema,
      system: QWEN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: textBlock }, ...imageParts],
        },
      ],
    });

    return Response.json({ analysis: object });
  } catch (err) {
    console.error("[/analyze/api/analyze] failed:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
