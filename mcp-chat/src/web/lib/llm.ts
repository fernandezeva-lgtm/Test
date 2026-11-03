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

export async function fetchProviders(): Promise<{ providers: ProviderInfo[]; default: string }> {
  const r = await fetch("/api/llm/providers");
  return r.json();
}

export async function fetchModels(provider: string, key?: string): Promise<string[]> {
  const r = await fetch(`/api/llm/models?provider=${encodeURIComponent(provider)}`, { headers: key ? { "x-llm-key": key } : {} });
  return (await r.json()).models ?? [];
}

export async function* streamChat(s: LlmSettings, messages: ChatMsg[], tools: ToolDef[] | undefined, signal?: AbortSignal): AsyncGenerator<LlmEvent> {
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
  let text = "";
  for await (const ev of streamChat(s, messages, undefined, signal)) {
    if (ev.type === "text") text += ev.delta;
    if (ev.type === "error") throw new Error(ev.message);
  }
  return text;
}
