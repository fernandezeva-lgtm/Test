// Runtime común de los widgets: conexión MCP Apps (App SDK oficial), tema del host,
// helpers de DOM sin innerHTML, formato y acciones (tools, mensajes, contexto, enlaces…).
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/client";

// ---------------- DOM ----------------
type Child = Node | string | number | false | null | undefined | Child[];
type Props = Record<string, unknown> & { class?: string; style?: string | Record<string, string> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props)
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = String(v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k in el && k !== "list" && k !== "type" && typeof v !== "string") (el as any)[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  append(el, children);
  return el;
}
export function append(el: Node, children: Child[]) {
  for (const c of children.flat(Infinity as 1) as Child[]) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const $root = () => document.getElementById("root")!;
export function render(...children: Child[]) {
  const r = $root();
  r.replaceChildren();
  append(r, children);
}

// ---------------- Formato ----------------
const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const EUR0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const eur = (n: number, dec = true) => (dec ? EUR : EUR0).format(n ?? 0);
export const signed = (n: number) => (n > 0 ? "+" : "") + eur(n);
export const pct = (n: number, d = 1) => `${n.toLocaleString("es-ES", { maximumFractionDigits: d })}%`;
export const fecha = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-ES", opts);
export const fechaCorta = (iso: string) => fecha(iso, { day: "numeric", month: "short" });
export const mesCorto = (ym: string) => new Date(ym + "-15T12:00:00").toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
export const mesLargo = (ym: string) => new Date(ym + "-15T12:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" });
export const diasHasta = (iso: string) => Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86400000);

export const CAT: Record<string, { e: string; c: string }> = {
  Nómina: { e: "💼", c: "#007eae" },
  "Otros ingresos": { e: "💰", c: "#0099d8" },
  Vivienda: { e: "🏠", c: "var(--ds-chart-2)" },
  Suministros: { e: "💡", c: "#5cbbe4" },
  Supermercado: { e: "🛒", c: "#007eae" },
  Restaurantes: { e: "🍽️", c: "#0099d8" },
  Transporte: { e: "🚗", c: "#87909c" },
  Compras: { e: "🛍️", c: "#00668e" },
  Ocio: { e: "🎬", c: "#23a6dd" },
  Suscripciones: { e: "🔁", c: "#4f7a94" },
  Salud: { e: "🩺", c: "#7fc8e8" },
  Viajes: { e: "✈️", c: "#9dd5ee" },
  Seguros: { e: "🛡️", c: "#5b6470" },
  Bizum: { e: "📲", c: "#0e8fc4" },
  Transferencias: { e: "🔄", c: "#3d6b85" },
  Ahorro: { e: "🐷", c: "#007eae" },
  Efectivo: { e: "🏧", c: "#b4bcc6" },
  Impuestos: { e: "🏛️", c: "#6b7682" },
  Intereses: { e: "📈", c: "#0099d8" },
};
export const cat = (c: string) => CAT[c] ?? { e: "•", c: "#87909c" };

// ---------------- UI pequeñas ----------------
let toastEl: HTMLDivElement | null = null;
export function toast(msg: string, bad = false) {
  if (!toastEl) {
    toastEl = h("div", { class: "toast" });
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.className = `toast show${bad ? " bad" : ""}`;
  clearTimeout((toastEl as any)._t);
  (toastEl as any)._t = setTimeout(() => (toastEl!.className = "toast"), 3200);
}

export function header(titulo: string, sub?: string, ...extra: Child[]) {
  return h("div", { class: "hdr" }, h("div", { class: "logo" }, h("span", null, "F")), h("div", null, h("h2", null, titulo), sub ? h("div", { class: "sub" }, sub) : null), h("div", { class: "sp" }), ...extra);
}

export function toggle(checked: boolean, onChange: (v: boolean) => void, danger = false) {
  const input = h("input", { type: "checkbox" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return h("label", { class: `switch${danger ? " danger" : ""}` }, input, h("span"));
}

export function tabs<T extends string>(opts: [T, string][], value: T, onChange: (v: T) => void) {
  return h("div", { class: "tabs" }, ...opts.map(([v, l]) => h("button", { class: `tab${v === value ? " on" : ""}`, onclick: () => onChange(v) }, l)));
}

export function skeleton(lines = 4) {
  return h(
    "div",
    { class: "col" },
    h("div", { class: "skel", style: { height: "22px", width: "40%" } }),
    ...Array.from({ length: lines }, (_, i) => h("div", { class: "skel", style: { height: "38px", opacity: String(1 - i * 0.15) } })),
  );
}

export function empty(emoji: string, text: string, ...extra: Child[]) {
  return h("div", { class: "empty" }, h("div", { class: "e" }, emoji), h("div", null, text), ...extra);
}

export function footer(...extra: Child[]) {
  return h("div", { class: "foot" }, h("span", null, "🔒 Banco Finora · datos simulados"), h("span", { class: "sp" }), ...extra);
}

/** Pantalla de firma con código OTP de 6 dígitos. Resuelve con el código o null si se cancela. */
export function otpPanel(resumen: Child, onSubmit: (otp: string) => Promise<boolean>, onCancel: () => void) {
  const inputs = Array.from({ length: 6 }, (_, i) =>
    h("input", {
      inputmode: "numeric",
      maxlength: "1",
      "aria-label": `Dígito ${i + 1}`,
      oninput: (e: Event) => {
        const el = e.target as HTMLInputElement;
        el.value = el.value.replace(/\D/g, "").slice(-1);
        if (el.value && i < 5) inputs[i + 1].focus();
        if (inputs.every((x) => x.value)) submit();
      },
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === "Backspace" && !(e.target as HTMLInputElement).value && i > 0) inputs[i - 1].focus();
      },
      onpaste: (e: ClipboardEvent) => {
        const t = e.clipboardData?.getData("text").replace(/\D/g, "").slice(0, 6) ?? "";
        if (t.length === 6) {
          e.preventDefault();
          t.split("").forEach((d, k) => (inputs[k].value = d));
          submit();
        }
      },
    }),
  );
  const err = h("div", { class: "hint err", style: { textAlign: "center", minHeight: "16px" } });
  const btn = h("button", { class: "btn primary block", onclick: () => submit() }, "Firmar y confirmar");
  let busy = false;
  async function submit() {
    if (busy) return;
    const code = inputs.map((x) => x.value).join("");
    if (code.length !== 6) {
      err.textContent = "Introduce los 6 dígitos";
      return;
    }
    busy = true;
    btn.disabled = true;
    btn.textContent = "Verificando…";
    const ok = await onSubmit(code);
    busy = false;
    btn.disabled = false;
    btn.textContent = "Firmar y confirmar";
    if (!ok) {
      inputs.forEach((x) => (x.value = ""));
      inputs[0].focus();
    }
  }
  const panel = h(
    "div",
    { class: "col fade" },
    resumen,
    h("div", { class: "card soft col", style: { alignItems: "center", gap: "8px" } },
      h("div", { class: "b" }, "🔐 Firma la operación"),
      h("div", { class: "small muted", style: { textAlign: "center" } }, "Hemos enviado un código de 6 dígitos a tu móvil ••• 678"),
      h("div", { class: "otp" }, ...inputs),
      err,
      h("div", { class: "xs faint" }, "Demo: vale cualquier código (000000 simula un error)"),
    ),
    btn,
    h("button", { class: "btn ghost block", onclick: onCancel }, "Volver"),
  );
  setTimeout(() => inputs[0].focus(), 50);
  return { panel, setError: (m: string) => (err.textContent = m) };
}

export function successPanel(titulo: string, detalle: Child, ...acciones: Child[]) {
  return h(
    "div",
    { class: "success fade" },
    h("div", { class: "check" }, "✓"),
    h("h3", { style: { fontSize: "17px" } }, titulo),
    h("div", { class: "muted", style: { margin: "6px 0 14px" } }, detalle),
    h("div", { class: "row", style: { justifyContent: "center", flexWrap: "wrap" } }, ...acciones),
  );
}

// ---------------- MCP Apps ----------------
export const app = new App({ name: "finora-widget", version: "1.0.0" }, { availableDisplayModes: ["inline", "fullscreen", "pip"] });

let hostCtx: McpUiHostContext = {};
export const hostContext = () => hostCtx;
const ctxListeners: ((c: McpUiHostContext) => void)[] = [];
export const onContext = (fn: (c: McpUiHostContext) => void) => ctxListeners.push(fn);

function applyContext(ctx: McpUiHostContext | undefined) {
  if (!ctx) return;
  hostCtx = { ...hostCtx, ...ctx };
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.displayMode) document.documentElement.dataset.mode = ctx.displayMode;
  ctxListeners.forEach((f) => f(hostCtx));
}

export interface WidgetOptions<T> {
  /** Llamado con structuredContent del resultado de la herramienta. */
  onData: (data: T, input: Record<string, unknown>) => void;
  /** Llamado en cuanto llegan los argumentos (antes del resultado). */
  onInput?: (input: Record<string, unknown>) => void;
  loading?: () => Node;
}

export async function mount<T>(opts: WidgetOptions<T>) {
  let input: Record<string, unknown> = {};
  render(opts.loading?.() ?? skeleton());
  app.ontoolinput = (p) => {
    input = p.arguments ?? {};
    opts.onInput?.(input);
  };
  app.ontoolinputpartial = (p) => {
    input = p.arguments ?? {};
  };
  app.ontoolresult = (r) => {
    if (r.isError) {
      render(empty("⚠️", textOf(r) || "La herramienta devolvió un error."));
      return;
    }
    opts.onData((r.structuredContent ?? {}) as T, input);
  };
  app.ontoolcancelled = (p) => render(empty("⏹️", `Operación cancelada${p.reason ? `: ${p.reason}` : ""}`));
  app.onhostcontextchanged = (ctx) => applyContext(ctx);
  app.onteardown = async () => ({});
  await app.connect();
  applyContext(app.getHostContext());
}

export const textOf = (r: CallToolResult) =>
  (r.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("\n");

/** Llama a una herramienta del servidor MCP a través del host. */
export async function call<T = any>(name: string, args: Record<string, unknown> = {}, opts: { silent?: boolean } = {}): Promise<{ ok: boolean; data: T; text: string }> {
  try {
    const r = await app.callServerTool({ name, arguments: args });
    const text = textOf(r);
    if (r.isError && !opts.silent) toast(text || "Error", true);
    return { ok: !r.isError, data: (r.structuredContent ?? {}) as T, text };
  } catch (e) {
    const text = (e as Error).message;
    if (!opts.silent) toast(text, true);
    return { ok: false, data: {} as T, text };
  }
}

/** Envía un mensaje al chat como si lo escribiera la usuaria (ui/message). */
export async function ask(text: string) {
  try {
    await app.sendMessage({ role: "user", content: [{ type: "text", text }] });
  } catch (e) {
    toast((e as Error).message, true);
  }
}

/** Informa al modelo del estado del widget sin generar un mensaje (ui/update-model-context). */
export function tellModel(text: string, structured?: Record<string, unknown>) {
  app.updateModelContext({ content: [{ type: "text", text }], ...(structured && { structuredContent: structured }) }).catch(() => {});
}

export function openLink(url: string) {
  app.openLink({ url }).catch(() => toast("El host no permite abrir enlaces", true));
}

export async function downloadText(filename: string, mimeType: string, text: string) {
  try {
    const r = await app.downloadFile({ contents: [{ type: "resource", resource: { uri: `file:///${filename}`, mimeType, text } }] });
    if (r.isError) toast("Descarga cancelada", true);
  } catch {
    toast("El host no permite descargas", true);
  }
}

export async function setMode(mode: "inline" | "fullscreen" | "pip") {
  try {
    const r = await app.requestDisplayMode({ mode });
    document.documentElement.dataset.mode = r.mode;
    return r.mode;
  } catch {
    return hostCtx.displayMode ?? "inline";
  }
}

export function fullscreenButton() {
  const modes = hostCtx.availableDisplayModes ?? [];
  if (!modes.includes("fullscreen")) return null;
  const isFull = () => (document.documentElement.dataset.mode ?? hostCtx.displayMode) === "fullscreen";
  const b = h("button", { class: "btn ghost sm", title: "Pantalla completa" }, isFull() ? "⤡" : "⤢");
  b.onclick = async () => {
    const m = await setMode(isFull() ? "inline" : "fullscreen");
    b.textContent = m === "fullscreen" ? "⤡" : "⤢";
  };
  return b;
}

/** Pide al LLM del host un texto (sampling/createMessage). */
export async function sample(prompt: string, system?: string): Promise<string | null> {
  if (!app.getHostCapabilities()?.sampling) return null;
  try {
    const r: any = await app.createSamplingMessage({
      messages: [{ role: "user", content: { type: "text", text: prompt } }],
      ...(system && { systemPrompt: system }),
      maxTokens: 500,
    });
    const c = Array.isArray(r.content) ? r.content : [r.content];
    return c.filter((x: any) => x?.type === "text").map((x: any) => x.text).join("\n");
  } catch (e) {
    toast((e as Error).message, true);
    return null;
  }
}
