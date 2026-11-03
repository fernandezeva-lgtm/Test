// Renderiza un recurso ui:// en un iframe aislado y lo conecta con el host mediante AppBridge (MCP Apps).
import { memo, useEffect, useRef, useState } from "react";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { AppBridge, buildAllowAttribute, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { McpUiDisplayMode, McpUiHostContext, McpUiResourceCsp } from "@modelcontextprotocol/ext-apps";
import { getState, hidePart, log, mcp, sampling, send, updateModelContext } from "../lib/store.ts";
import { hostStyles } from "../lib/theme.ts";

interface Props {
  toolCallId: string;
  toolName: string;
  uri: string;
  args: Record<string, unknown>;
  result?: CallToolResult;
  status: string;
  theme: "light" | "dark";
}

/** Inyecta una CSP restrictiva basada en _meta.ui.csp (por defecto: sin red). */
function withCsp(html: string, csp?: McpUiResourceCsp) {
  const res = (csp?.resourceDomains ?? []).join(" ");
  const policy = [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${res}`,
    `style-src 'unsafe-inline' ${res}`,
    `img-src data: blob: ${res}`,
    `font-src data: ${res}`,
    `media-src data: blob: ${res}`,
    `connect-src ${(csp?.connectDomains ?? []).join(" ") || "'none'"}`,
    `frame-src ${(csp?.frameDomains ?? []).join(" ") || "'none'"}`,
    `base-uri ${(csp?.baseUriDomains ?? []).join(" ") || "'none'"}`,
    "form-action 'none'",
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + meta) : meta + html;
}

/** Altura máxima en línea; si el widget es más alto, hace scroll interno o se abre a pantalla completa. */
const MAX_INLINE = 780;

function WidgetFrameImpl({ toolCallId, toolName, uri, args, result, status, theme }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const sent = useRef({ init: false, input: false, result: false });
  const [height, setHeight] = useState(160);
  const [mode, setMode] = useState<McpUiDisplayMode>("inline");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [border, setBorder] = useState(true);
  const resultRef = useRef(result);
  resultRef.current = result;

  const context = (m: McpUiDisplayMode, t = theme): McpUiHostContext => {
    const w = boxRef.current?.clientWidth ?? 720;
    const tool = mcp.tool(toolName);
    return {
      theme: t,
      styles: hostStyles(t),
      displayMode: m,
      availableDisplayModes: ["inline", "fullscreen", "pip"],
      containerDimensions: m === "inline" ? { width: w, maxHeight: MAX_INLINE } : { width: m === "pip" ? 400 : innerWidth, height: m === "pip" ? 560 : innerHeight - 56 },
      locale: "es-ES",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: "mcp-chat/1.0",
      platform: "web",
      deviceCapabilities: { touch: matchMedia("(pointer: coarse)").matches, hover: matchMedia("(hover: hover)").matches },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      ...(tool && { toolInfo: { id: toolCallId, tool } }),
    };
  };

  // Crear el bridge y cargar el HTML una sola vez por widget.
  useEffect(() => {
    let cancelled = false;
    const iframe = iframeRef.current!;
    const bridge = new AppBridge(
      null,
      { name: "MCP Chat", version: "1.0.0" },
      {
        openLinks: {},
        downloadFile: {},
        serverTools: {},
        serverResources: {},
        logging: {},
        updateModelContext: { text: {}, structuredContent: {} },
        message: { text: {} },
        sampling: {},
        sandbox: { csp: {} },
      },
      { hostContext: context("inline") },
    );
    bridgeRef.current = bridge;

    bridge.oninitialized = () => {
      sent.current.init = true;
      bridge.sendToolInput({ arguments: args });
      sent.current.input = true;
      const r = resultRef.current;
      if (r) {
        bridge.sendToolResult(r);
        sent.current.result = true;
      }
    };
    bridge.onsizechange = ({ height: h }) => {
      if (h != null) setHeight(Math.min(Math.max(Math.ceil(h), 60), MAX_INLINE));
    };
    bridge.oncalltool = async (params) => {
      if (!mcp.canAppCall(params.name)) return { isError: true, content: [{ type: "text", text: `El widget no puede llamar a ${params.name}` }] };
      log("tool", `Widget ${toolName} → ${params.name}(${JSON.stringify(params.arguments ?? {})})`);
      return mcp.callTool(params.name, (params.arguments ?? {}) as Record<string, unknown>);
    };
    bridge.onreadresource = async (params) => mcp.client.readResource(params);
    bridge.onlistresources = async (params) => mcp.client.listResources(params);
    bridge.onmessage = async (params) => {
      const text = params.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
      log("message", `Widget ${toolName} envió: ${text.slice(0, 120)}`);
      send(text, toolName);
      return {};
    };
    bridge.onupdatemodelcontext = async (params) => {
      const text = [...(params.content ?? []).map((c) => (c.type === "text" ? c.text : "")), params.structuredContent ? JSON.stringify(params.structuredContent) : ""].filter(Boolean).join("\n");
      updateModelContext(toolCallId, toolName, text);
      return {};
    };
    bridge.onopenlink = async ({ url }) => {
      const safe = /^(https?:|mailto:|tel:)/i.test(url);
      if (!safe || !confirm(`El widget quiere abrir:\n${url}\n\n¿Continuar?`)) return { isError: true };
      log("link", url);
      window.open(url, "_blank", "noopener,noreferrer");
      return {};
    };
    bridge.ondownloadfile = async ({ contents }) => {
      for (const c of contents) {
        if (c.type !== "resource") continue;
        const r = c.resource;
        const name = decodeURIComponent(r.uri.split("/").pop() || "archivo");
        const blob = "text" in r ? new Blob([r.text], { type: r.mimeType ?? "text/plain" }) : new Blob([Uint8Array.from(atob(r.blob), (ch) => ch.charCodeAt(0))], { type: r.mimeType ?? "application/octet-stream" });
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        log("download", name);
      }
      return {};
    };
    bridge.onrequestdisplaymode = async ({ mode: m }) => {
      setMode(m);
      log("mode", `${toolName} → ${m}`);
      bridge.setHostContext(context(m));
      return { mode: m };
    };
    bridge.oncreatesamplingmessage = async (params) => {
      const text = await sampling(params as never);
      return { role: "assistant", content: { type: "text", text }, model: getState().settings.model || getState().settings.provider, stopReason: "endTurn" };
    };
    bridge.onloggingmessage = (p) => console.debug(`[widget ${toolName}]`, p.level, p.data);
    bridge.onrequestteardown = () => hidePart(toolCallId);

    (async () => {
      try {
        const res = await mcp.uiResource(uri);
        if (cancelled) return;
        setBorder(res.prefersBorder !== false);
        if (res.permissions) iframe.allow = buildAllowAttribute(res.permissions);
        await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
        iframe.srcdoc = withCsp(res.html, res.csp);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      if (sent.current.init) bridge.teardownResource({}).catch(() => {});
      setTimeout(() => bridge.close().catch(() => {}), 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, toolCallId]);

  // El resultado puede llegar después de inicializar el widget.
  useEffect(() => {
    const b = bridgeRef.current;
    if (!b || !sent.current.init) return;
    if (result && !sent.current.result) {
      b.sendToolResult(result);
      sent.current.result = true;
    } else if (status === "cancelled" && !sent.current.result) b.sendToolCancelled({ reason: "Cancelado por la usuaria" });
  }, [result, status]);

  // Tema y tamaño del contenedor.
  useEffect(() => {
    bridgeRef.current?.setHostContext(context(mode, theme));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  useEffect(() => {
    const ro = new ResizeObserver(() => bridgeRef.current?.setHostContext(context(mode)));
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const changeMode = (m: McpUiDisplayMode) => {
    setMode(m);
    bridgeRef.current?.setHostContext(context(m));
  };

  if (error) return <div className="notice error">No se pudo cargar el widget {uri}: {error}</div>;

  return (
    <>
      {mode !== "inline" && <div className="widget-placeholder" style={{ height: Math.min(height, 120) }} onClick={() => changeMode("inline")}>Widget abierto en {mode === "pip" ? "ventana flotante" : "pantalla completa"} · pulsa para volver</div>}
      {mode === "fullscreen" && <div className="widget-backdrop" onClick={() => changeMode("inline")} />}
      <div ref={boxRef} className={`widget-box mode-${mode}${border ? " bordered" : ""}${loaded ? " loaded" : ""}`}>
        {mode !== "inline" && (
          <div className="widget-bar">
            <span className="widget-bar-title">{mcp.tool(toolName)?.title ?? toolName}</span>
            {mode === "pip" && <button onClick={() => changeMode("fullscreen")} title="Pantalla completa">⤢</button>}
            {mode === "fullscreen" && <button onClick={() => changeMode("pip")} title="Ventana flotante">▣</button>}
            <button onClick={() => changeMode("inline")} title="Volver al chat">✕</button>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title={`Widget ${toolName}`}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          style={{ height: mode === "inline" ? height : undefined }}
          onLoad={() => setLoaded(true)}
        />
        {mode === "inline" && (
          <div className="widget-tools">
            <button onClick={() => changeMode("pip")} title="Ventana flotante">▣</button>
            <button onClick={() => changeMode("fullscreen")} title="Pantalla completa">⤢</button>
          </div>
        )}
      </div>
    </>
  );
}

export const WidgetFrame = memo(WidgetFrameImpl);
