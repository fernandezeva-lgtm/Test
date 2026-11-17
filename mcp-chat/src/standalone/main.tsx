// Versión compartible de MCP Chat: sin backend. El servidor MCP de Finora, sus datos y el LLM
// corren dentro de la página; el cliente MCP se conecta por un transporte en memoria.
(globalThis as { __FINORA_STANDALONE__?: boolean }).__FINORA_STANDALONE__ = true;

import { createRoot } from "react-dom/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { WIDGET_CSS, WIDGET_JS } from "virtual:finora-widgets";
import { createBankServer, type WidgetId } from "../bank/server.ts";
import { chat, providers as allProviders } from "../backend/llm.ts";
import { App } from "../web/App.tsx";
import { setClaudeSample, setLlmBackend, type ProviderInfo, type SampleFn } from "../web/lib/llm.ts";
import { init, mcp } from "../web/lib/store.ts";
import "../design/tokens.css";
import "../web/styles.css";

// HTML de cada widget: plantilla + el bundle compartido (se construye al pedir el recurso ui://).
const widgetHtml = (id: WidgetId) =>
  `<!doctype html><html lang="es" data-widget="${id}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${id}</title><style>${WIDGET_CSS}</style></head><body><div id="root"></div><script type="module">${WIDGET_JS}</script></body></html>`;

mcp.createTransport = async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createBankServer(widgetHtml).connect(serverSide);
  return clientSide;
};

// Claude a través del visor de Artifacts (capacidad `sample`), si la página se abre en claude.ai.
type ClaudeHost = { use(name: string): Promise<unknown> };
async function detectClaude(): Promise<SampleFn | null> {
  const host = (globalThis as { claude?: ClaudeHost }).claude;
  if (!host?.use) return null;
  const sample = (await Promise.race([host.use("sample"), new Promise((r) => setTimeout(() => r(null), 4000))]).catch(() => null)) as SampleFn | null;
  if (!sample) return null;
  const limits = await sample.limits?.().catch(() => null);
  return limits && !limits.tools ? null : sample;
}
const claudeReady = detectClaude().then((s) => (setClaudeSample(s), s));

setLlmBackend({
  async providers() {
    const sample = await claudeReady;
    const list: ProviderInfo[] = [
      ...(sample
        ? [
            {
              id: "claude",
              label: "Claude · con tu cuenta",
              needsKey: false,
              configured: true,
              defaultModel: "quick",
              models: ["quick", "default", "complex"],
              notes: "Usa tu propia cuenta de Claude. Te pedirá permiso la primera vez. quick = rápido; default/complex = más razonamiento.",
            },
          ]
        : []),
      ...allProviders()
        .filter((p) => !["ollama", "custom"].includes(p.id))
        .map((p) => ({ ...p, configured: !p.needsKey })),
    ];
    return { providers: list, default: sample ? "claude" : "demo" };
  },
  async models(provider) {
    if (provider === "claude") return ["quick", "default", "complex"];
    return allProviders().find((p) => p.id === provider)?.models ?? [];
  },
  async *stream(s, messages, tools, signal) {
    yield* chat({ provider: s.provider, model: s.model, messages: messages as never, tools: tools as never, apiKey: s.apiKeys[s.provider] }, signal);
  },
});

// Fuentes del DS sin bloquear: una <link> en el HTML retrasaría el script hasta que cargue Google Fonts
// (o lo dejaría en blanco si esa red está lenta o bloqueada). Sin red, se usa la fuente del sistema.
document.head.append(
  Object.assign(document.createElement("link"), {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap",
  }),
);

createRoot(document.getElementById("app")!).render(<App />);
init();
