// Social Caption Maker - describe your photo or post, and an AI on YOUR machine (QVAC) writes captions and hashtags.
// The page counts characters for each platform. Open http://localhost:3092 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The QVAC worker can be slow to start on some computers. Wait up to 3 minutes for it.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= "180000";
const { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } = await import("@qvac/sdk");

const PORT = 3092;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the AI model (downloads the first time, then it's cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };
async function startModel() {
  try {
    status.message = "Loading the AI model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: "llm",
      onProgress: (p) => { const v = typeof p === "number" ? p : p?.percentage; if (typeof v === "number") status.percent = Math.round(v); },
    });
    status.ready = true; status.message = "AI caption writer ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) { status.error = String(err?.message || err); console.error("Could not load model:", err); }
}

// One AI job at a time
let chain = Promise.resolve();
const enqueue = (job) => { const p = chain.then(job); chain = p.catch(() => {}); return p; };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data)); req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

// QVAC "structured output": several captions plus a list of hashtags.
const SCHEMA = { type: "object", properties: { captions: { type: "array", items: { type: "string" } }, hashtags: { type: "array", items: { type: "string" } } }, required: ["captions", "hashtags"], additionalProperties: false };
const VIBES = { funny: "funny and playful", aesthetic: "short, dreamy and aesthetic", inspiring: "uplifting and inspiring", professional: "professional and clear", cozy: "warm and cozy" };
const prompt = (vibe, emojis, platform) => `You write social media captions for ${platform}. Style: ${VIBES[vibe]}. Reply with JSON only.
captions: 4 different captions (1 to 3 sentences each). ${emojis ? "Use a few fitting emojis." : "Do not use any emojis."} Don't put hashtags inside the captions.
hashtags: 10 relevant hashtags (single words or CamelCase, no spaces), from popular to specific.
Only describe what the user says is in the post. Never invent places, people or events.`;

// ---- Step 2: the web server ----
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(path.join(__dirname, "public", "index.html")));
    }
    if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);
    if (req.method === "POST" && req.url === "/api/captions") {
      if (!status.ready) return json(res, 503, { error: "The AI caption writer is not ready yet." });
      const b = JSON.parse(await readBody(req)), about = clean(b.about, 600), vibe = VIBES[b.vibe] ? b.vibe : "funny", platform = clean(b.platform, 20) || "Instagram";
      if (about.length < 5) return json(res, 400, { error: "Describe your post first." });
      const r = await enqueue(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // This is the QVAC call that runs the AI on-device
            const run = completion({ modelId, stream: true, history: [{ role: "system", content: prompt(vibe, !!b.emojis, platform) }, { role: "user", content: "My post: " + about }], responseFormat: { type: "json_schema", json_schema: { name: "Captions", schema: SCHEMA } } });
            let out = "";
            for await (const event of run.events) if (event.type === "contentDelta") out += event.text;
            const j = JSON.parse(out), seen = new Set();
            const captions = (j.captions || []).map((c) => String(c).replace(/#\w+/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 600)).filter((c) => c.length > 3 && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase())).slice(0, 5);
            const tags = [...new Set((j.hashtags || []).map((h) => "#" + String(h).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")).filter((h) => h.length > 2).map((h) => h))].slice(0, 15);
            if (captions.length) return { captions, hashtags: tags };
          } catch (err) { console.error("Caption attempt failed:", err.message); }
        }
        return null;
      });
      return r ? json(res, 200, r) : json(res, 502, { error: "The AI couldn't write captions. Try again." });
    }
    res.writeHead(404); res.end("Not found");
  } catch (err) { console.error(err); json(res, 500, { error: String(err?.message || err) }); }
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
