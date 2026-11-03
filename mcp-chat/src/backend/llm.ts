// Proxy hacia LLMs gratuitos con API compatible con OpenAI (Groq, Gemini, OpenRouter, Ollama…)
// y un modo "demo" sin conexión. Normaliza el streaming a eventos NDJSON sencillos.
import { demoChat } from "./demo.ts";

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}
export interface ToolDef {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}
export type LlmEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; arguments: string }
  | { type: "done"; finish?: string; usage?: unknown }
  | { type: "error"; message: string };

export interface ProviderDef {
  id: string;
  label: string;
  baseUrl: string;
  envKey?: string;
  needsKey: boolean;
  defaultModel: string;
  models: string[];
  signupUrl?: string;
  notes?: string;
}

export function providers(): ProviderDef[] {
  return [
    {
      id: "demo",
      label: "Demo sin conexión (reglas)",
      baseUrl: "",
      needsKey: false,
      defaultModel: "finora-demo",
      models: ["finora-demo"],
      notes: "Simula un LLM con reglas para probar los widgets sin ninguna clave.",
    },
    {
      id: "groq",
      label: "Groq · gratis",
      baseUrl: "https://api.groq.com/openai/v1",
      envKey: "GROQ_API_KEY",
      needsKey: true,
      defaultModel: "openai/gpt-oss-120b",
      models: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct", "qwen/qwen3-32b", "openai/gpt-oss-20b"],
      signupUrl: "https://console.groq.com/keys",
      notes: "Muy rápido. Capa gratuita con límites por minuto.",
    },
    {
      id: "gemini",
      label: "Google Gemini · gratis",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      envKey: "GEMINI_API_KEY",
      needsKey: true,
      defaultModel: "gemini-2.5-flash",
      models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
      signupUrl: "https://aistudio.google.com/apikey",
      notes: "Capa gratuita de Google AI Studio.",
    },
    {
      id: "openrouter",
      label: "OpenRouter · modelos :free",
      baseUrl: "https://openrouter.ai/api/v1",
      envKey: "OPENROUTER_API_KEY",
      needsKey: true,
      defaultModel: "openai/gpt-oss-20b:free",
      models: ["openai/gpt-oss-20b:free", "meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen3-coder:free", "mistralai/mistral-small-3.2-24b-instruct:free"],
      signupUrl: "https://openrouter.ai/keys",
      notes: "Elige modelos con sufijo :free que soporten tools.",
    },
    {
      id: "ollama",
      label: "Ollama · local",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
      needsKey: false,
      defaultModel: process.env.OLLAMA_MODEL || "qwen2.5:7b",
      models: ["qwen2.5:7b", "llama3.1:8b", "qwen3:8b"],
      signupUrl: "https://ollama.com/download",
      notes: "Gratis y privado en tu máquina (modelos con soporte de tools).",
    },
    ...(process.env.OPENAI_COMPAT_BASE_URL
      ? [
          {
            id: "custom",
            label: process.env.OPENAI_COMPAT_LABEL || "Personalizado (OpenAI compatible)",
            baseUrl: process.env.OPENAI_COMPAT_BASE_URL,
            envKey: "OPENAI_COMPAT_API_KEY",
            needsKey: false,
            defaultModel: process.env.OPENAI_COMPAT_MODEL || "default",
            models: [process.env.OPENAI_COMPAT_MODEL || "default"],
          },
        ]
      : []),
  ];
}

export function providerStatus() {
  return providers().map((p) => ({
    ...p,
    configured: !p.needsKey || Boolean(p.envKey && process.env[p.envKey]),
  }));
}

export function defaultProvider() {
  const pref = process.env.LLM_PROVIDER;
  const list = providerStatus();
  if (pref && list.some((p) => p.id === pref)) return pref;
  return list.find((p) => p.id !== "demo" && p.id !== "ollama" && p.configured)?.id ?? "demo";
}

export interface ChatRequest {
  provider: string;
  model?: string;
  messages: ChatMsg[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  apiKey?: string; // clave aportada por el usuario desde el navegador (opcional)
}

export async function* chat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<LlmEvent> {
  if (req.provider === "demo") {
    yield* demoChat(req, signal);
    return;
  }
  const p = providers().find((x) => x.id === req.provider);
  if (!p) {
    yield { type: "error", message: `Proveedor desconocido: ${req.provider}` };
    return;
  }
  const key = req.apiKey || (p.envKey ? process.env[p.envKey] : undefined);
  if (p.needsKey && !key) {
    yield { type: "error", message: `Falta la API key de ${p.label}. Añádela en Ajustes o en .env (${p.envKey}). Consíguela gratis en ${p.signupUrl}` };
    return;
  }

  const body: Record<string, unknown> = {
    model: req.model || p.defaultModel,
    messages: req.messages,
    stream: true,
    temperature: req.temperature ?? 0.3,
  };
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.tools?.length) {
    body.tools = req.tools;
    body.tool_choice = "auto";
  }

  let res: Response;
  try {
    res = await fetch(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    yield { type: "error", message: `No se pudo conectar con ${p.label}: ${(e as Error).message}` };
    return;
  }
  if (!res.ok || !res.body) {
    const txt = (await res.text().catch(() => "")).slice(0, 600);
    yield { type: "error", message: `${p.label} respondió ${res.status}: ${txt}` };
    return;
  }

  // Parseo de Server-Sent Events con acumulación de tool_calls por índice.
  const calls = new Map<number, { id: string; name: string; args: string }>();
  let finish: string | undefined;
  let usage: unknown;
  const decoder = new TextDecoder();
  let buf = "";
  const reader = res.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json.error) {
        yield { type: "error", message: json.error.message ?? JSON.stringify(json.error) };
        return;
      }
      if (json.usage) usage = json.usage;
      for (const ch of json.choices ?? []) {
        const d = ch.delta ?? ch.message ?? {};
        if (typeof d.content === "string" && d.content) yield { type: "text", delta: d.content };
        for (const tc of d.tool_calls ?? []) {
          const i = tc.index ?? calls.size;
          const cur = calls.get(i) ?? { id: "", name: "", args: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          calls.set(i, cur);
        }
        if (ch.finish_reason) finish = ch.finish_reason;
      }
    }
  }
  for (const [i, c] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    if (!c.name) continue;
    yield { type: "tool_call", id: c.id || `call_${Date.now()}_${i}`, name: c.name, arguments: c.args || "{}" };
  }
  yield { type: "done", finish, usage };
}

export async function listModels(providerId: string, apiKey?: string): Promise<string[]> {
  const p = providers().find((x) => x.id === providerId);
  if (!p || !p.baseUrl) return p?.models ?? [];
  const key = apiKey || (p.envKey ? process.env[p.envKey] : undefined);
  if (p.needsKey && !key) return p.models;
  try {
    const res = await fetch(`${p.baseUrl.replace(/\/$/, "")}/models`, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return p.models;
    const json: any = await res.json();
    let ids: string[] = (json.data ?? json.models ?? []).map((m: any) => String(m.id ?? m.name).replace(/^models\//, ""));
    if (p.id === "openrouter") ids = ids.filter((id) => id.endsWith(":free"));
    if (p.id === "gemini") ids = ids.filter((id) => id.startsWith("gemini"));
    if (p.id === "groq") ids = ids.filter((id) => !/whisper|tts|guard|playai|prompt-guard/i.test(id));
    const set = new Set([...p.models.filter((m) => ids.includes(m)), ...ids.sort()]);
    return set.size ? [...set] : p.models;
  } catch {
    return p.models;
  }
}
