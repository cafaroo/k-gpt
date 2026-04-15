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
  /** URL to a JSON blob {version:1, frames:[{timestamp, dataUrl}]} */
  framesUrl?: string;
  /** Legacy fallback: inline base64 frames (subject to 4.5 MB limit) */
  frameDataUrls?: string[];
  modelId?: string;
};

type FramesBundle = {
  version: 1;
  frames: { timestamp: number; dataUrl: string }[];
};

export async function POST(req: Request) {
  try {
    const { extraction, framesUrl, frameDataUrls, modelId } =
      (await req.json()) as RequestBody;

    if (!extraction) {
      return Response.json({ error: "extraction required" }, { status: 400 });
    }

    let dataUrls: string[];
    if (framesUrl) {
      const bundleRes = await fetch(framesUrl);
      if (!bundleRes.ok) {
        return Response.json(
          {
            error: `failed to fetch frames bundle (HTTP ${bundleRes.status})`,
          },
          { status: 400 }
        );
      }
      const bundle = (await bundleRes.json()) as FramesBundle;
      dataUrls = bundle.frames.map((f) => f.dataUrl);
    } else if (frameDataUrls && frameDataUrls.length > 0) {
      dataUrls = frameDataUrls;
    } else {
      return Response.json(
        { error: "framesUrl or frameDataUrls required" },
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

    const imageParts = dataUrls.map((url) => ({
      type: "image" as const,
      image: url,
    }));

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
    return Response.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
