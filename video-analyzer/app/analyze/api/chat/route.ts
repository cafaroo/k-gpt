import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { buildVideoAnalysisPrompt } from "@/lib/video/prompts";
import type { PerformanceData, VideoExtraction } from "@/lib/video/types";

export const maxDuration = 60;

type RequestBody = {
  messages: UIMessage[];
  videoContext: {
    extraction: VideoExtraction;
    performance?: PerformanceData;
  };
};

export async function POST(req: Request) {
  const { messages, videoContext } = (await req.json()) as RequestBody;

  if (!videoContext?.extraction) {
    return new Response("videoContext.extraction is required", { status: 400 });
  }

  const system = buildVideoAnalysisPrompt(
    videoContext.extraction,
    videoContext.performance
  );

  const result = streamText({
    model: getLanguageModel("anthropic/claude-sonnet-4-5"),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
