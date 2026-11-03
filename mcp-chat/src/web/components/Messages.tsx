import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Part, UiMessage } from "../lib/store.ts";
import { mcp } from "../lib/store.ts";
import { WidgetFrame } from "./WidgetFrame.tsx";

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={["img"]}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ToolChip({ part }: { part: Extract<Part, { type: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const t = mcp.tool(part.name);
  const label = t?.title ?? part.name;
  const icon = part.status === "running" ? <span className="spinner" /> : part.status === "error" ? "⚠️" : part.status === "cancelled" ? "⏹" : "✓";
  const resText = part.result?.content?.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");
  return (
    <div className={`tool-chip ${part.status}`}>
      <button className="tool-head" onClick={() => setOpen(!open)}>
        <span className="tool-icon">{icon}</span>
        <span>
          {part.status === "running" ? "Usando" : "Usó"} <b>{label}</b>
        </span>
        <span className="tool-server">· {mcp.serverName}</span>
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="tool-body">
          <div className="tool-sec">Petición</div>
          <pre>{JSON.stringify({ tool: part.name, arguments: part.args }, null, 2)}</pre>
          {part.result && (
            <>
              <div className="tool-sec">Respuesta {part.uiUri && <span className="pill">UI {part.uiUri}</span>}</div>
              <pre>{resText}</pre>
              {part.result.structuredContent ? (
                <details>
                  <summary>structuredContent</summary>
                  <pre>{JSON.stringify(part.result.structuredContent, null, 2).slice(0, 20000)}</pre>
                </details>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageView({ m, theme, streaming }: { m: UiMessage; theme: "light" | "dark"; streaming: boolean }) {
  if (m.role === "user")
    return (
      <div className="msg user">
        <div className="bubble">
          {m.fromWidget && <div className="from-widget">↳ desde el widget</div>}
          {m.parts.map((p, i) => (p.type === "text" ? <div key={i}>{p.text}</div> : null))}
        </div>
      </div>
    );
  return (
    <div className="msg assistant">
      <div className="avatar">✦</div>
      <div className="content">
        {m.parts.map((p, i) => {
          if (p.type === "text") return <Markdown key={i} text={p.text} />;
          if (p.type === "notice") return <div key={i} className={`notice ${p.tone ?? ""}`}>{p.text}</div>;
          return (
            <div key={p.id} className="tool-part">
              <ToolChip part={p} />
              {p.uiUri && !p.hidden && p.status !== "error" && (
                <WidgetFrame toolCallId={p.id} toolName={p.name} uri={p.uiUri} args={p.args} result={p.result} status={p.status} theme={theme} />
              )}
            </div>
          );
        })}
        {streaming && m.parts.every((p) => p.type !== "text") && !m.parts.some((p) => p.type === "tool" && p.status === "running") && <div className="thinking"><span /><span /><span /></div>}
      </div>
    </div>
  );
}
