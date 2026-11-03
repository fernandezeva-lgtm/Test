import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageView } from "./components/Messages.tsx";
import { Settings } from "./components/Settings.tsx";
import { current, deleteChat, mcp, newChat, selectChat, send, setState, stop, useStore } from "./lib/store.ts";

const SUGERENCIAS = [
  { t: "¿Cuánto dinero tengo?", s: "Posición global y alertas", q: "¿Cuánto dinero tengo? Hazme un resumen de mi situación" },
  { t: "¿En qué gasto más?", s: "Gráficos de los últimos 6 meses", q: "¿En qué he gastado más en los últimos 6 meses?" },
  { t: "Enviar un Bizum", s: "25 € a Marta por la cena", q: "Envía un Bizum de 25 € a Marta por la cena del sábado" },
  { t: "Cargo sospechoso", s: "Revisar PayPal y bloquear tarjeta", q: "Veo un cargo raro de PayPal en mi tarjeta, ¿qué hago?" },
  { t: "Simular préstamo", s: "Coche eléctrico de 28.000 €", q: "Simula un préstamo para un coche eléctrico de 28.000 € a 6 años" },
  { t: "Recibos y suscripciones", s: "Subidas de precio y pagos pendientes", q: "Enséñame mis recibos, suscripciones y pagos pendientes" },
  { t: "Movimientos en Amazon", s: "Listado filtrable con detalle", q: "Enséñame mis compras en Amazon" },
  { t: "Catálogo de productos", s: "Cuentas, tarjetas, seguros…", q: "¿Qué productos me recomendáis?" },
];

function Sidebar() {
  const st = useStore();
  const convs = [...st.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <aside className={`sidebar ${st.sidebar ? "open" : ""}`}>
      <div className="side-top">
        <button className="icon-btn" title="Cerrar barra lateral" onClick={() => setState({ sidebar: false })}>☰</button>
        <button className="icon-btn" title="Nuevo chat" onClick={newChat}>✎</button>
      </div>
      <button className="new-chat" onClick={newChat}>
        <span className="logo-mini">✦</span> Nuevo chat
      </button>
      <div className="side-section">Conectores</div>
      <div className="connector">
        <span className={`dot ${st.mcpStatus}`} />
        <div>
          <div className="b">{mcp.serverName || "Banco Finora"}</div>
          <div className="muted small">{st.mcpStatus === "ready" ? `MCP · ${mcp.tools.length} herramientas` : st.mcpStatus === "error" ? "Sin conexión" : "Conectando…"}</div>
        </div>
      </div>
      <div className="side-section">Chats</div>
      <nav className="chats">
        {convs.length === 0 && <div className="muted small" style={{ padding: "4px 10px" }}>Aún no hay conversaciones</div>}
        {convs.map((c) => (
          <div key={c.id} className={`chat-item ${c.id === st.currentId ? "on" : ""}`} onClick={() => selectChat(c.id)}>
            <span className="ellipsis">{c.title}</span>
            <button
              className="del"
              title="Borrar"
              onClick={(e) => {
                e.stopPropagation();
                deleteChat(c.id);
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </nav>
      <div className="side-user">
        <div className="user-ava">LM</div>
        <div>
          <div className="b">Lucía Martín</div>
          <div className="muted small">Plan gratuito · datos simulados</div>
        </div>
      </div>
    </aside>
  );
}

function ModelPicker({ onSettings }: { onSettings: () => void }) {
  const st = useStore();
  const [open, setOpen] = useState(false);
  const p = st.providers.find((x) => x.id === st.settings.provider);
  return (
    <div className="picker">
      <button className="picker-btn" onClick={() => setOpen(!open)}>
        MCP Chat <span className="muted">{p ? `· ${st.settings.model || p.defaultModel}` : ""}</span> ▾
      </button>
      {open && (
        <>
          <div className="pop-back" onClick={() => setOpen(false)} />
          <div className="pop">
            <div className="pop-title">Modelo</div>
            {st.providers.map((x) => {
              const usable = x.configured || !!st.settings.apiKeys[x.id] || !x.needsKey;
              return (
                <button
                  key={x.id}
                  className={`pop-item ${x.id === st.settings.provider ? "on" : ""}`}
                  onClick={() => {
                    if (!usable) {
                      setOpen(false);
                      onSettings();
                      return;
                    }
                    setState({ settings: { ...st.settings, provider: x.id, model: x.defaultModel } });
                    setOpen(false);
                  }}
                >
                  <div>
                    <div>{x.label}</div>
                    <div className="muted small">{usable ? x.defaultModel : "Añade una API key gratuita →"}</div>
                  </div>
                  {x.id === st.settings.provider && <span>✓</span>}
                </button>
              );
            })}
            <button className="pop-item" onClick={() => (setOpen(false), onSettings())}>
              ⚙️ Más ajustes…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Activity({ onClose }: { onClose: () => void }) {
  const st = useStore();
  const conv = current();
  const ctx = conv ? Object.entries(conv.modelContext) : [];
  return (
    <aside className="activity">
      <div className="modal-head">
        <h3>Inspector MCP Apps</h3>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>Mensajes entre el host, los widgets (AppBridge) y el servidor MCP.</div>
      {ctx.length > 0 && (
        <>
          <div className="side-section">Contexto del modelo (ui/update-model-context)</div>
          {ctx.map(([k, v]) => (
            <div key={k} className="act ctx">
              <b>{v.tool}</b> {v.text.slice(0, 300)}
            </div>
          ))}
        </>
      )}
      <div className="side-section">Actividad</div>
      {st.activity.length === 0 && <div className="muted small">Sin actividad todavía.</div>}
      {st.activity.map((a, i) => (
        <div key={i} className={`act ${a.kind}`}>
          <span className="act-kind">{a.kind}</span> {a.text}
          <div className="faint xs">{new Date(a.at).toLocaleTimeString("es-ES")}</div>
        </div>
      ))}
    </aside>
  );
}

function Composer({ big }: { big?: boolean }) {
  const st = useStore();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!ta.current) return;
    ta.current.style.height = "auto";
    ta.current.style.height = Math.min(ta.current.scrollHeight, 220) + "px";
  }, [text]);
  const submit = () => {
    if (!text.trim() || st.busy) return;
    send(text);
    setText("");
  };
  const herramientas = mcp.modelTools().filter((t) => mcp.uiUriFor(t.name));
  return (
    <div className={`composer ${big ? "big" : ""}`}>
      <div className="composer-box">
        <textarea
          ref={ta}
          rows={1}
          value={text}
          autoFocus
          placeholder="Pregunta lo que quieras sobre tus finanzas…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-row">
          <div className="picker">
            <button className="tool-btn" onClick={() => setMenu(!menu)} title="Herramientas del conector">
              ＋ Herramientas
            </button>
            {menu && (
              <>
                <div className="pop-back" onClick={() => setMenu(false)} />
                <div className="pop up">
                  <div className="pop-title">{mcp.serverName} · apps</div>
                  {herramientas.map((t) => (
                    <button
                      key={t.name}
                      className="pop-item"
                      onClick={() => {
                        setMenu(false);
                        send(`Abre ${t.title ?? t.name}`);
                      }}
                    >
                      <div>
                        <div>{t.title ?? t.name}</div>
                        <div className="muted small ellipsis" style={{ maxWidth: 300 }}>{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {st.busy ? (
            <button className="send stop" onClick={stop} title="Detener">■</button>
          ) : (
            <button className="send" disabled={!text.trim()} onClick={submit} title="Enviar">↑</button>
          )}
        </div>
      </div>
      <div className="disclaimer">Banco Finora es ficticio y los datos son simulados. El modelo puede cometer errores.</div>
    </div>
  );
}

function Welcome() {
  const [prompts, setPrompts] = useState(SUGERENCIAS);
  useEffect(() => {
    // Las sugerencias vienen de los prompts que expone el servidor MCP (si hay).
    if (!mcp.prompts.length) return;
    Promise.all(mcp.prompts.slice(0, 6).map(async (p) => ({ t: p.title ?? p.name, s: "Prompt del servidor MCP", q: await mcp.promptText(p.name) })))
      .then((ps) => setPrompts([...ps, ...SUGERENCIAS.slice(6)]))
      .catch(() => {});
  }, []);
  return (
    <div className="welcome">
      <h1>¿En qué puedo ayudarte, Lucía?</h1>
      <Composer big />
      <div className="sugs">
        {prompts.map((s) => (
          <button key={s.t} className="sug" onClick={() => send(s.q)}>
            <b>{s.t}</b>
            <span className="muted">{s.s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const st = useStore();
  const [settings, setSettings] = useState(false);
  const [inspector, setInspector] = useState(false);
  const conv = current();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prov = st.providers.find((x) => x.id === st.settings.provider);

  useEffect(() => {
    document.documentElement.dataset.theme = st.theme;
  }, [st.theme]);
  // Como en ChatGPT: al enviar, el mensaje de la usuaria sube arriba y la respuesta crece debajo.
  const nMsgs = conv?.messages.length ?? 0;
  useEffect(() => {
    const users = scroller.current?.querySelectorAll(".msg.user");
    const last = users?.[users.length - 1];
    if (last) last.scrollIntoView({ block: "start", behavior: stick.current ? "smooth" : "auto" });
    stick.current = true;
  }, [nMsgs, st.currentId]);

  return (
    <div className="app">
      <Sidebar />
      {st.sidebar && <div className="side-back" onClick={() => setState({ sidebar: false })} />}
      <main className="main">
        <header className="top">
          {!st.sidebar && (
            <>
              <button className="icon-btn" title="Abrir barra lateral" onClick={() => setState({ sidebar: true })}>☰</button>
              <button className="icon-btn" title="Nuevo chat" onClick={newChat}>✎</button>
            </>
          )}
          <ModelPicker onSettings={() => setSettings(true)} />
          <div style={{ flex: 1 }} />
          {prov?.id === "demo" && (
            <button className="demo-pill" onClick={() => setSettings(true)} title="Configura un LLM gratuito">
              Modo demo · conectar LLM gratis
            </button>
          )}
          <button className={`icon-btn ${inspector ? "on" : ""}`} title="Inspector MCP Apps" onClick={() => setInspector(!inspector)}>⌁</button>
          <button className="icon-btn" title="Cambiar tema" onClick={() => setState({ theme: st.theme === "dark" ? "light" : "dark" })}>{st.theme === "dark" ? "☀︎" : "☾"}</button>
          <button className="icon-btn" title="Ajustes" onClick={() => setSettings(true)}>⚙︎</button>
        </header>
        {st.mcpStatus === "error" && <div className="notice error" style={{ margin: 12 }}>No se pudo conectar con el servidor MCP: {st.mcpError}</div>}
        {!conv ? (
          <Welcome />
        ) : (
          <>
            <div
              className="scroller"
              ref={scroller}
            >
              <div className="thread">
                {conv.messages.map((m, i) => (
                  <MessageView key={m.id} m={m} theme={st.theme} streaming={st.busy && i === conv.messages.length - 1} />
                ))}
              </div>
            </div>
            <Composer />
          </>
        )}
      </main>
      {inspector && <Activity onClose={() => setInspector(false)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  );
}
