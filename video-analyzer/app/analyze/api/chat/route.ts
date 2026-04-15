import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { buildVideoAnalysisPrompt } from "@/lib/video/prompts";
import type { AudioAnalysis } from "@/lib/video/audio-schema";
import type { QwenAnalysis } from "@/lib/video/qwen-schema";
import type { PerformanceData, VideoExtraction } from "@/lib/video/types";

export const maxDuration = 60;

type RequestBody = {
  messages: UIMessage[];
  videoContext: {
    extraction: VideoExtraction;
    performance?: PerformanceData;
    qwenAnalysis?: QwenAnalysis | null;
    audioAnalysis?: AudioAnalysis | null;
  };
  selectedModel?: string;
};

const ALLOWED_MODELS = new Set([
  "anthropic/claude-sonnet-4-5",
  "alibaba/qwen3-vl-thinking",
  "alibaba/qwen3-vl-instruct",
]);

export async function POST(req: Request) {
  const { messages, videoContext, selectedModel } =
    (await req.json()) as RequestBody;

  if (!videoContext?.extraction) {
    return new Response("videoContext.extraction is required", { status: 400 });
  }

  const modelId =
    selectedModel && ALLOWED_MODELS.has(selectedModel)
      ? selectedModel
      : "anthropic/claude-sonnet-4-5";

  const baseSystem = buildVideoAnalysisPrompt(
    videoContext.extraction,
    videoContext.performance
  );

  const systemParts: string[] = [baseSystem];

  if (videoContext.qwenAnalysis) {
    systemParts.push(
      `## Prior visual analysis by Qwen3 VL Thinking\n\nUse as ground truth; don't re-analyze — discuss and extend.\n\n\`\`\`json\n${JSON.stringify(
        videoContext.qwenAnalysis,
        null,
        2
      )}\n\`\`\``
    );
  }

  if (videoContext.audioAnalysis) {
    systemParts.push(
      `## Prior audio analysis by Gemini 3 Flash\n\nMusic, voiceover, sentiment, sfx and sound design — treat as ground truth.\n\n\`\`\`json\n${JSON.stringify(
        videoContext.audioAnalysis,
        null,
        2
      )}\n\`\`\``
    );
  }

  const system = systemParts.join("\n\n");

  const result = streamText({
    model: getLanguageModel(modelId),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
