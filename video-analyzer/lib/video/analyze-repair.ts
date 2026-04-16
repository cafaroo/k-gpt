import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { gateway, generateText, type LanguageModel } from "ai";
import { jsonrepair } from "jsonrepair";

/**
 * Optional fallback: when a pass hydrates to low completeness (many empty
 * array fields), we can ask a cheap fast model to re-format the raw output
 * against the schema skeleton. This is *not* a re-analysis — it's a text →
 * text reformatting call with no video input, so it's a fraction of the
 * original pass cost.
 *
 * Gated behind `ANALYZE_REPAIR_PASS=on` env var. Leave off until metrics
 * show it's needed.
 */

const REPAIR_SYSTEM_PROMPT = `You are a strict JSON reformatter. You receive:
  1. A JSON skeleton describing the EXACT shape an output must match.
  2. A previous analysis payload whose fields don't quite line up with that skeleton.

Your only job: return a JSON object whose structure matches the skeleton EXACTLY while preserving every piece of data from the previous analysis.

Rules:
- Do NOT invent new content. Use the content from the previous analysis. If a mandatory field is missing, infer the closest reasonable value from the existing content.
- Enum fields MUST be one of the listed values (case-exact, kebab-case).
- Arrays should carry as many items as the previous analysis supports — copy them all, don't drop content.
- Numbers marked <number 0-10> must be in 0-10; <number 0-100> in 0-100.
- Return ONLY the JSON object. No prose, no markdown fences, no comments.`;

function getRepairModel(): LanguageModel {
  const provider = process.env.ANALYSIS_PROVIDER ?? "gateway";
  if (provider === "google") {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANALYSIS_PROVIDER=google requires GOOGLE_API_KEY in env"
      );
    }
    return createGoogleGenerativeAI({ apiKey })("gemini-2.5-flash");
  }
  return gateway.languageModel("google/gemini-3-flash");
}

export function isRepairPassEnabled(): boolean {
  return process.env.ANALYZE_REPAIR_PASS === "on";
}

export type RepairResult = {
  raw: unknown;
  rawText: string;
  latencyMs: number;
  parseError: string | null;
  repaired: boolean;
};

export async function runRepairPass(opts: {
  rawJson: unknown;
  schemaSkeleton: string;
  label: string;
}): Promise<RepairResult> {
  const t0 = Date.now();
  const userPrompt = [
    "=== SCHEMA SKELETON (shape to match) ===",
    opts.schemaSkeleton,
    "",
    "=== PREVIOUS ANALYSIS (content to preserve) ===",
    JSON.stringify(opts.rawJson, null, 2),
    "",
    "=== YOUR JOB ===",
    "Return the previous analysis reshaped to match the schema skeleton EXACTLY. Preserve every insight; fix the structure only.",
  ].join("\n");

  const { text } = await generateText({
    model: getRepairModel(),
    system: REPAIR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const latencyMs = Date.now() - t0;

  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown = null;
  let parseError: string | null = null;
  let repaired = false;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    try {
      parsed = JSON.parse(jsonrepair(stripped));
      repaired = true;
    } catch {
      parseError = err instanceof Error ? err.message : String(err);
    }
  }

  return { raw: parsed, rawText: text, latencyMs, parseError, repaired };
}
