// Estado de la app (conversaciones, ajustes) y bucle agéntico: LLM ⇄ herramientas MCP.
import { useSyncExternalStore } from "react";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { complete, fetchProviders, streamChat, type ChatMsg, type LlmSettings, type ProviderInfo, type ToolDef } from "./llm.ts";
import { McpConnection } from "./mcp.ts";

export type Part =
  | { type: "text"; text: string }
  | {
      type: "tool";
      id: string;
      name: string;
      args: Record<string, unknown>;
      status: "running" | "done" | "error" | "cancelled";
      result?: CallToolResult;
      uiUri?: string;
      hidden?: boolean;
    }
  | { type: "notice"; text: string; tone?: "info" | "error" };

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  parts: Part[];
  fromWidget?: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: UiMessage[];
  llm: ChatMsg[];
  modelContext: Record<string, { tool: string; text: string }>;
}

export interface ActivityItem {
  at: number;
  kind: "tool" | "message" | "context" | "sampling" | "link" | "download" | "mode";
  text: string;
}

interface State {
  conversations: Conversation[];
  currentId: string | null;
  busy: boolean;
  mcpStatus: "connecting" | "ready" | "error";
  mcpError?: string;
  providers: ProviderInfo[];
  settings: LlmSettings;
  theme: "light" | "dark";
  sidebar: boolean;
  activity: ActivityItem[];
}

const LS = { convs: "mcpchat.convs.v1", settings: "mcpchat.settings.v1", theme: "mcpchat.theme" };
const load = <T,>(k: string, def: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : def;
  } catch {
    return def;
  }
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const mcp = new McpConnection("/mcp");

let state: State = {
  conversations: load<Conversation[]>(LS.convs, []),
  currentId: null,
  busy: false,
  mcpStatus: "connecting",
  providers: [],
  settings: load<LlmSettings>(LS.settings, { provider: "", model: "", apiKeys: {} }),
  theme: load<"light" | "dark">(LS.theme, matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  sidebar: innerWidth > 900,
  activity: [],
};
let version = 0;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout>;

export function emit(persist = false) {
  version++;
  listeners.forEach((l) => l());
  if (persist) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS.convs, JSON.stringify(state.conversations.slice(0, 30)));
      } catch {
        /* cuota llena: ignoramos */
      }
    }, 400);
  }
}
export const getState = () => state;
export function setState(patch: Partial<State>, persist = false) {
  state = { ...state, ...patch };
  if (patch.settings) localStorage.setItem(LS.settings, JSON.stringify(state.settings));
  if (patch.theme) localStorage.setItem(LS.theme, JSON.stringify(state.theme));
  emit(persist);
}
export function useStore() {
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => version,
  );
  return state;
}
export const current = () => state.conversations.find((c) => c.id === state.currentId) ?? null;
export function log(kind: ActivityItem["kind"], text: string) {
  state.activity = [{ at: Date.now(), kind, text }, ...state.activity].slice(0, 60);
  emit();
}

// ---------------- Inicialización ----------------
export async function init() {
  try {
    const p = await fetchProviders();
    const s = state.settings;
    const valid = p.providers.find((x) => x.id === s.provider);
    const provider = valid ? s.provider : p.default;
    const prov = p.providers.find((x) => x.id === provider)!;
    setState({ providers: p.providers, settings: { ...s, provider, model: valid && s.model ? s.model : prov.defaultModel } });
  } catch {
    /* backend no disponible */
  }
  try {
    await mcp.connect();
    setState({ mcpStatus: "ready" });
  } catch (e) {
    setState({ mcpStatus: "error", mcpError: (e as Error).message });
  }
}

// ---------------- Conversaciones ----------------
export function newChat() {
  setState({ currentId: null });
}
export function selectChat(id: string) {
  setState({ currentId: id, sidebar: innerWidth > 900 ? state.sidebar : false });
}
export function deleteChat(id: string) {
  setState({ conversations: state.conversations.filter((c) => c.id !== id), currentId: state.currentId === id ? null : state.currentId }, true);
}
export function clearChats() {
  setState({ conversations: [], currentId: null }, true);
}

function ensureConversation(firstText: string): Conversation {
  let c = current();
  if (!c) {
    c = { id: uid(), title: firstText.slice(0, 60), updatedAt: Date.now(), messages: [], llm: [], modelContext: {} };
    state.conversations = [c, ...state.conversations];
    state.currentId = c.id;
  }
  return c;
}

// ---------------- Agente ----------------
let abort: AbortController | null = null;
const queue: { text: string; fromWidget?: string }[] = [];

export function stop() {
  abort?.abort();
}

function systemPrompt() {
  const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return [
    `Eres un asistente conversacional (como ChatGPT o Claude) conectado por MCP al servidor "${mcp.serverName}". Hoy es ${hoy}. Responde siempre en español, de forma cercana y concisa, usando Markdown.`,
    "Muchas herramientas muestran un widget interactivo (MCP App) al usuario: cuando lo hagan, NO repitas en texto los datos que ya se ven; añade solo 1-3 frases con lo más relevante o el siguiente paso.",
    "Usa las herramientas siempre que la pregunta dependa de datos de la clienta; no inventes cifras.",
    "Las operaciones con dinero se preparan con su herramienta y la usuaria las confirma y firma en el widget. Nunca afirmes que una operación se ha realizado salvo que el contexto de un widget lo confirme.",
    "Llama a una sola herramienta con widget por respuesta salvo que se pida explícitamente comparar varias cosas.",
    mcp.instructions ? `Instrucciones del servidor: ${mcp.instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function toolDefs(): ToolDef[] {
  return mcp.modelTools().map((t) => {
    const schema: Record<string, unknown> = { ...(t.inputSchema as Record<string, unknown>) };
    delete schema.$schema;
    if (!schema.type) schema.type = "object";
    if (!schema.properties) schema.properties = {};
    return { type: "function", function: { name: t.name, description: (t.description ?? t.title ?? "").slice(0, 1000), parameters: schema } };
  });
}

function resultText(r: CallToolResult) {
  const t = (r.content ?? [])
    .map((c) => (c.type === "text" ? c.text : c.type === "resource_link" ? `[recurso ${c.uri}]` : `[${c.type}]`))
    .join("\n");
  return (r.isError ? "ERROR: " : "") + (t.length > 7000 ? t.slice(0, 7000) + "…(truncado)" : t);
}

export async function send(text: string, fromWidget?: string) {
  text = text.trim();
  if (!text) return;
  if (state.busy) {
    queue.push({ text, fromWidget });
    return;
  }
  const conv = ensureConversation(text);
  conv.messages.push({ id: uid(), role: "user", parts: [{ type: "text", text }], fromWidget });
  conv.llm.push({ role: "user", content: text });
  conv.updatedAt = Date.now();
  const asis: UiMessage = { id: uid(), role: "assistant", parts: [] };
  conv.messages.push(asis);
  setState({ busy: true }, true);
  abort = new AbortController();
  const signal = abort.signal;

  try {
    for (let step = 0; step < 6; step++) {
      // Contexto aportado por los widgets (ui/update-model-context)
      const ctx = Object.values(conv.modelContext);
      const messages: ChatMsg[] = [
        { role: "system", content: systemPrompt() },
        ...conv.llm,
        ...(ctx.length ? [{ role: "system" as const, content: `Estado actual de los widgets en pantalla (actualizado por la usuaria):\n${ctx.map((c) => `- [${c.tool}] ${c.text}`).join("\n")}` }] : []),
      ];
      let textPart: { type: "text"; text: string } | null = null;
      let fullText = "";
      const calls: { id: string; name: string; arguments: string }[] = [];
      for await (const ev of streamChat(state.settings, messages, toolDefs(), signal)) {
        if (ev.type === "text") {
          if (!textPart) {
            textPart = { type: "text", text: "" };
            asis.parts.push(textPart);
          }
          textPart.text += ev.delta;
          fullText += ev.delta;
          emit();
        } else if (ev.type === "tool_call") calls.push(ev);
        else if (ev.type === "error") {
          asis.parts.push({ type: "notice", text: ev.message, tone: "error" });
          emit(true);
        }
      }
      conv.llm.push({
        role: "assistant",
        content: fullText || null,
        ...(calls.length && { tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments || "{}" } })) }),
      });
      if (!calls.length) break;

      for (const c of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.arguments || "{}") ?? {};
        } catch {
          /* argumentos inválidos */
        }
        const part: Extract<Part, { type: "tool" }> = { type: "tool", id: c.id, name: c.name, args, status: "running", uiUri: mcp.uiUriFor(c.name) };
        asis.parts.push(part);
        emit();
        const r = mcp.tool(c.name) ? await mcp.callTool(c.name, args) : { isError: true, content: [{ type: "text" as const, text: `La herramienta ${c.name} no existe` }] };
        part.result = r;
        part.status = r.isError ? "error" : "done";
        conv.llm.push({ role: "tool", tool_call_id: c.id, content: resultText(r) });
        log("tool", `Modelo → ${c.name}(${JSON.stringify(args)})`);
        emit(true);
        if (signal.aborted) break;
      }
      if (signal.aborted) break;
    }
  } catch (e) {
    if (!signal.aborted) asis.parts.push({ type: "notice", text: (e as Error).message, tone: "error" });
  } finally {
    if (signal.aborted) {
      asis.parts.push({ type: "notice", text: "Respuesta detenida." });
      for (const p of asis.parts) if (p.type === "tool" && p.status === "running") p.status = "cancelled";
      // Mantener el historial coherente: cada tool_call necesita su respuesta.
      const last = conv.llm[conv.llm.length - 1];
      if (last?.role === "assistant" && last.tool_calls)
        for (const tc of last.tool_calls) if (!conv.llm.some((m) => m.tool_call_id === tc.id)) conv.llm.push({ role: "tool", tool_call_id: tc.id, content: "Cancelado por la usuaria" });
    }
    if (!asis.parts.length) asis.parts.push({ type: "notice", text: "El modelo no devolvió respuesta." });
    abort = null;
    conv.updatedAt = Date.now();
    setState({ busy: false }, true);
    const next = queue.shift();
    if (next) setTimeout(() => send(next.text, next.fromWidget), 50);
  }
}

/** ui/update-model-context: el widget informa al modelo sin generar un turno. */
export function updateModelContext(toolCallId: string, tool: string, text: string) {
  const conv = current();
  if (!conv) return;
  conv.modelContext[toolCallId] = { tool, text: text.slice(0, 2000) };
  log("context", `${tool}: ${text.slice(0, 140)}`);
  emit(true);
}

/** sampling/createMessage pedido por un widget: usamos el mismo LLM sin herramientas. */
export async function sampling(params: { messages: { role: string; content: unknown }[]; systemPrompt?: string; maxTokens?: number }) {
  const msgs: ChatMsg[] = [];
  if (params.systemPrompt) msgs.push({ role: "system", content: params.systemPrompt });
  for (const m of params.messages) {
    const parts = Array.isArray(m.content) ? m.content : [m.content];
    const text = parts.map((p: any) => (p?.type === "text" ? p.text : "")).join("\n");
    msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: text });
  }
  log("sampling", `Widget pidió al LLM: ${String(msgs[msgs.length - 1]?.content).slice(0, 100)}…`);
  return complete(state.settings, msgs);
}

export function hidePart(toolCallId: string) {
  for (const c of state.conversations) for (const m of c.messages) for (const p of m.parts) if (p.type === "tool" && p.id === toolCallId) p.hidden = true;
  emit(true);
}
