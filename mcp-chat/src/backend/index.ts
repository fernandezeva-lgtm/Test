// Servidor HTTP: expone el servidor MCP de Finora (/mcp), el proxy de LLM (/api/llm/*)
// y, en producción, la web del chat compilada (dist/web).
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createBankServer } from "../bank/server.ts";
import { chat, defaultProvider, listModels, providerStatus, type ChatRequest } from "./llm.ts";

// Carga .env / .env.local sin dependencias.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const f of [".env", ".env.local"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = Number(process.env.PORT || 8787);
const app = new Hono();

// ---- MCP (Streamable HTTP). Cualquier cliente MCP puede conectarse a /mcp ----
const mcp = createMcpHandler(() => createBankServer(), {
  onerror: (e) => console.error("[mcp]", e.message),
});
app.all("/mcp", (c) => mcp.fetch(c.req.raw));

// ---- LLM ----
app.get("/api/llm/providers", (c) => c.json({ providers: providerStatus(), default: defaultProvider() }));
app.get("/api/llm/models", async (c) => c.json({ models: await listModels(c.req.query("provider") ?? "demo", c.req.header("x-llm-key") || undefined) }));

app.post("/api/llm/chat", async (c) => {
  const body = (await c.req.json()) as ChatRequest;
  if (!Array.isArray(body.messages) || body.messages.length > 400) return c.json({ error: "Petición no válida" }, 400);
  body.apiKey = c.req.header("x-llm-key") || undefined;
  const abort = new AbortController();
  c.req.raw.signal.addEventListener("abort", () => abort.abort());
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const ev of chat(body, abort.signal)) ctrl.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      } catch (e) {
        if (!abort.signal.aborted) ctrl.enqueue(enc.encode(JSON.stringify({ type: "error", message: (e as Error).message }) + "\n"));
      }
      ctrl.close();
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache" } });
});

app.get("/api/health", (c) => c.json({ ok: true }));

// ---- Web compilada (npm run build && npm start) ----
const WEB = join(ROOT, "dist", "web");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};
app.get("*", (c) => {
  if (!existsSync(WEB)) return c.text("Web no compilada. En desarrollo abre http://localhost:5173 (npm run dev) o ejecuta npm run build.", 404);
  const path = decodeURIComponent(new URL(c.req.url).pathname);
  let file = join(WEB, path);
  if (!file.startsWith(WEB) || !existsSync(file) || !extname(file)) file = join(WEB, "index.html");
  return new Response(readFileSync(file), { headers: { "content-type": MIME[extname(file)] ?? "application/octet-stream" } });
});

serve({ fetch: app.fetch, port: PORT, hostname: process.env.HOST || "0.0.0.0" }, (info) => {
  console.log(`\n  🏦 Servidor MCP Finora   → http://localhost:${info.port}/mcp`);
  console.log(`  🤖 LLM por defecto       → ${defaultProvider()}`);
  if (existsSync(WEB)) console.log(`  💬 Chat                  → http://localhost:${info.port}\n`);
});
