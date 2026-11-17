// Cliente del proxy de LLM del backend (/api/llm/*), con respuesta NDJSON en streaming.
export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}
export interface ToolDef {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}
export type LlmEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; arguments: string }
  | { type: "done"; finish?: string }
  | { type: "error"; message: string };

export interface ProviderInfo {
  id: string;
  label: string;
  needsKey: boolean;
  configured: boolean;
  defaultModel: string;
  models: string[];
  signupUrl?: string;
  notes?: string;
  envKey?: string;
}

export interface LlmSettings {
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
}

/** De dónde salen los LLM: el backend HTTP (por defecto) o el propio navegador (versión compartible). */
export interface LlmBackend {
  providers(): Promise<{ providers: ProviderInfo[]; default: string }>;
  models(provider: string, key?: string): Promise<string[]>;
  stream(s: LlmSettings, messages: ChatMsg[], tools: ToolDef[] | undefined, signal?: AbortSignal): AsyncGenerator<LlmEvent>;
}
let backend: LlmBackend = {
  providers: async () => (await fetch("/api/llm/providers")).json(),
  models: async (provider, key) => {
    const r = await fetch(`/api/llm/models?provider=${encodeURIComponent(provider)}`, { headers: key ? { "x-llm-key": key } : {} });
    return (await r.json()).models ?? [];
  },
  stream: httpStream,
};
export function setLlmBackend(b: LlmBackend) {
  backend = b;
}

/** Función `sample` del visor de Artifacts (Claude con la cuenta de quien abre la página), si existe. */
export type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  limits?: () => Promise<{ tools?: { maxCount: number } }>;
};
let claudeSample: SampleFn | null = null;
export const setClaudeSample = (fn: SampleFn | null) => (claudeSample = fn);
export const getClaudeSample = () => claudeSample;

/** Página publicada sin backend (todo corre en el navegador). */
export const isStandalone = () => Boolean((globalThis as { __FINORA_STANDALONE__?: boolean }).__FINORA_STANDALONE__);

export const fetchProviders = () => backend.providers();
export const fetchModels = (provider: string, key?: string) => backend.models(provider, key);
export const streamChat = (s: LlmSettings, messages: ChatMsg[], tools: ToolDef[] | undefined, signal?: AbortSignal) => backend.stream(s, messages, tools, signal);

async function* httpStream(s: LlmSettings, messages: ChatMsg[], tools: ToolDef[] | undefined, signal?: AbortSignal): AsyncGenerator<LlmEvent> {
  const key = s.apiKeys[s.provider];
  const res = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-llm-key": key } : {}) },
    body: JSON.stringify({ provider: s.provider, model: s.model, messages, tools }),
    signal,
  });
  if (!res.ok || !res.body) {
    yield { type: "error", message: `Error ${res.status} del servidor` };
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield JSON.parse(line) as LlmEvent;
    }
  }
}

/** Completa un texto sin herramientas (para sampling/createMessage de los widgets). */
export async function complete(s: LlmSettings, messages: ChatMsg[], signal?: AbortSignal) {
  if (s.provider === "claude" && claudeSample) {
    const turns = messages.filter((m) => m.content).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) }));
    const r = await claudeSample(turns, { modelTier: s.model || "quick", cache: false, ...(signal && { signal }) }).catch((e: { code?: string; message?: string }) => {
      throw new Error(e?.code === "not_granted" ? "No has dado permiso a la página para usar Claude." : e?.message || "Error de Claude");
    });
    return r.text;
  }
  let text = "";
  for await (const ev of streamChat(s, messages, undefined, signal)) {
    if (ev.type === "text") text += ev.delta;
    if (ev.type === "error") throw new Error(ev.message);
  }
  return text;
}
