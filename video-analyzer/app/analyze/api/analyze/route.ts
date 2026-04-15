import { generateObject } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  buildQwenUserMessage,
  QWEN_SYSTEM_PROMPT,
} from "@/lib/video/qwen-prompt";
import { QwenAnalysisSchema } from "@/lib/video/qwen-schema";
import type { VideoExtraction, VideoMetadata } from "@/lib/video/types";

export const maxDuration = 120;

type RequestBody = {
  /** Full extraction (legacy path, subject to body-size limits) */
  extraction?: VideoExtraction;
  /** Slim path: just metadata + pre-computed text summaries */
  metadata?: VideoMetadata;
  audioText?: string;
  motionText?: string;
  frameDataUrls: string[];
  framesUrl?: string;
  modelId?: string;
};

type FramesBundle = {
  version: 1;
  frames: { timestamp: number; dataUrl: string }[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { extraction, metadata, audioText, motionText, framesUrl, modelId } =
      body;
    let { frameDataUrls } = body;

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
      frameDataUrls = bundle.frames.map((f) => f.dataUrl);
    }

    if (!frameDataUrls || frameDataUrls.length === 0) {
      return Response.json(
        { error: "frameDataUrls required" },
        { status: 400 }
      );
    }

    // Build the text block. Prefer explicit slim-mode (pre-summarized) over
    // full extraction payload (legacy).
    let metadataText: string;
    let aText: string;
    let mText: string;
    if (metadata && audioText && motionText) {
      metadataText = [
        "Video metadata:",
        `- filename: ${metadata.filename}`,
        `- duration: ${metadata.duration.toFixed(1)}s`,
        `- dimensions: ${metadata.width}×${metadata.height} (${metadata.aspectRatio})`,
        `- filesize: ${(metadata.fileSize / 1024 / 1024).toFixed(1)} MB`,
        `- bitrate: ${Math.round(metadata.bitrate / 1000)} kbps`,
      ].join("\n");
      aText = audioText;
      mText = motionText;
    } else if (extraction) {
      const parts = buildQwenUserMessage(extraction);
      metadataText = parts.metadataText;
      aText = parts.audioText;
      mText = parts.motionText;
    } else {
      return Response.json(
        { error: "metadata+audioText+motionText or extraction required" },
        { status: 400 }
      );
    }

    const textBlock = [
      metadataText,
      "",
      aText,
      "",
      mText,
      "",
      "Keyframes (chronological) attached below.",
    ].join("\n");

    const imageParts = frameDataUrls.map((url) => ({
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
    const message = err instanceof Error ? err.message : "Analysis failed";
    const isCreditError =
      /free credits|no_providers_available|restricted access/i.test(message);
    return Response.json(
      {
        error: message,
        hint: isCreditError
          ? "Vercel AI Gateway free credits are temporarily restricted — top up at vercel.com/ai."
          : undefined,
      },
      { status: isCreditError ? 402 : 500 }
    );
  }
}
