import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

console.log("1. Uploading sample video (public)…");
const bytes = readFileSync("public/samples/ugc-sample.mp4");
const t0 = Date.now();
const { url } = await put(
  `analysis/video/proof-${Date.now().toString(36)}.mp4`,
  bytes,
  { access: "public", contentType: "video/mp4", token }
);
console.log(
  `   uploaded in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${url}`
);

console.log("\n2. Fetching URL without auth (public access test)…");
const t1 = Date.now();
const fetchRes = await fetch(url);
console.log(
  `   HTTP ${fetchRes.status} in ${((Date.now() - t1) / 1000).toFixed(1)}s, content-type: ${fetchRes.headers.get("content-type")}, size: ${fetchRes.headers.get("content-length")}`
);
if (!fetchRes.ok) {
  console.error("   ❌ Public fetch failed. Store might still be private.");
  process.exit(1);
}

const videoBytes = new Uint8Array(await fetchRes.arrayBuffer());
console.log(
  `   ✅ ${(videoBytes.byteLength / 1024 / 1024).toFixed(2)} MB fetched`
);

console.log("\n3. Running 2-pass Gemini analysis…");
const { generateText } = await import("ai");
const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
const { QwenAnalysisSchema, ensureBaseShape, normalizeScores } = await import(
  "../lib/video/qwen-schema"
);
const { QWEN_SYSTEM_PROMPT } = await import("../lib/video/qwen-prompt");
const { AnalysisExtendedSchema } = await import(
  "../lib/video/analysis-extended-schema"
);
const { EXTENDED_SYSTEM_PROMPT } = await import(
  "../lib/video/analysis-extended-prompt"
);

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "",
});
const model = google("gemini-2.5-flash");

const metadataText = [
  "Video metadata:",
  "- filename: ugc-sample.mp4",
  "- duration: ~60s",
  "- dimensions: 1080×1920 (9:16)",
].join("\n");

const content = [
  { type: "text" as const, text: metadataText },
  {
    type: "file" as const,
    data: videoBytes,
    mediaType: "video/mp4",
  },
];

async function runPass(
  label: string,
  schema: unknown,
  system: string
): Promise<unknown> {
  const t = Date.now();
  const { text } = await generateText({
    model,
    system: `${system}\n\nReturn ONLY a single valid JSON object matching the described shape. No prose, no markdown fences.`,
    messages: [{ role: "user", content: content as any }],
  });
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(stripped);
  const res = (schema as any).safeParse(parsed);
  console.log(
    `   ${label}: ${((Date.now() - t) / 1000).toFixed(1)}s, keys=${Object.keys(parsed).length}, zod=${res.success ? "✅" : `❌ (${res.error?.issues.length} issues)`}`
  );
  if (!res.success && res.error) {
    for (const iss of res.error.issues.slice(0, 5)) {
      console.log(`     · ${iss.path.join(".")} [${iss.code}] ${iss.message}`);
    }
  }
  return parsed;
}

const [basePass, extPass] = await Promise.all([
  runPass("base", QwenAnalysisSchema, QWEN_SYSTEM_PROMPT),
  runPass("extended", AnalysisExtendedSchema, EXTENDED_SYSTEM_PROMPT),
]);

console.log("\n4. Hydrating base + merging…");
const hydrated = ensureBaseShape(normalizeScores(basePass));
console.log(
  `   overall.score=${hydrated.overall.score}, hook.score=${hydrated.hook.score}, beatMap=${hydrated.beatMap.length} beats, scenes=${hydrated.scenes.length} scenes`
);

console.log("\n5. Extended sample fields:");
const ext = extPass as Record<string, any>;
console.log(
  `   transcript.language=${ext.transcript?.language}, segments=${ext.transcript?.segments?.length ?? 0}`
);
console.log(
  `   trustSignals=${ext.trustSignals?.length ?? 0}, patternInterrupts=${ext.patternInterrupts?.length ?? 0}, microMoments=${ext.microMoments?.length ?? 0}`
);
console.log(
  `   music.genre=${ext.audioExtended?.music?.genre}, soundEffects=${ext.audioExtended?.soundEffects?.length ?? 0}`
);

console.log("\n✅ E2E proof complete");
