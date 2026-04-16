import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

console.log("1. Uploading to new (public) store…");
const bytes = readFileSync("public/samples/ugc-sample.mp4");
const t0 = Date.now();
const { url } = await put(
  `analysis/video/proof-${Date.now().toString(36)}.mp4`,
  bytes,
  { access: "public", contentType: "video/mp4", token }
);
console.log(`   ✅ uploaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`   URL: ${url}`);

console.log("\n2. Fetching without auth (public test)…");
const t1 = Date.now();
const res = await fetch(url);
console.log(
  `   HTTP ${res.status} in ${((Date.now() - t1) / 1000).toFixed(1)}s, size: ${res.headers.get("content-length")} bytes, type: ${res.headers.get("content-type")}`
);
if (res.ok) {
  console.log("   ✅ Public access works");
} else {
  console.log("   ❌ Public fetch failed");
}
