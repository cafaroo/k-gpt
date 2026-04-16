import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { customProvider, gateway, type LanguageModel } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return gateway.languageModel(titleModel.id);
}

/**
 * Returns the Gemini model used for video analysis. Provider is selected by
 * the ANALYSIS_PROVIDER env var:
 *   - "google" → Google AI Studio direct (requires GOOGLE_API_KEY).
 *     Better error messages and higher structured-output tolerance.
 *   - anything else (default) → Vercel AI Gateway with OIDC auth.
 *
 * Pass an override via modelId if you need a specific Gemini variant.
 */
export function getAnalysisModel(modelId?: string): LanguageModel {
  const provider = process.env.ANALYSIS_PROVIDER ?? "gateway";

  if (provider === "google") {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANALYSIS_PROVIDER=google requires GOOGLE_API_KEY in env"
      );
    }
    const google = createGoogleGenerativeAI({ apiKey });
    // Google AI Studio names the preview model without the "google/" prefix.
    return google(modelId ?? "gemini-2.5-flash");
  }

  return gateway.languageModel(modelId ?? "google/gemini-3-flash");
}
