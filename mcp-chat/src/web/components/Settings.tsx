import { useEffect, useState } from "react";
import { fetchModels } from "../lib/llm.ts";
import { clearChats, mcp, setState, useStore } from "../lib/store.ts";

export function Settings({ onClose }: { onClose: () => void }) {
  const st = useStore();
  const [provider, setProvider] = useState(st.settings.provider);
  const [model, setModel] = useState(st.settings.model);
  const [keys, setKeys] = useState<Record<string, string>>(st.settings.apiKeys);
  const [models, setModels] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const p = st.providers.find((x) => x.id === provider);

  useEffect(() => {
    let ok = true;
    const prov = st.providers.find((x) => x.id === provider);
    setModels(prov?.models ?? []);
    fetchModels(provider, keys[provider]).then((m) => ok && m.length && setModels(m));
    return () => {
      ok = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, keys[provider]]);

  const save = () => {
    setState({ settings: { provider, model: model || p?.defaultModel || "", apiKeys: keys } });
    onClose();
  };
  const origin = location.origin;
  const mcpUrl = `${origin}/mcp`;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Ajustes</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <section>
          <h3>Modelo de lenguaje</h3>
          <p className="muted">Todos estos proveedores tienen capa gratuita. Las claves se guardan solo en tu navegador y se envían a tu propio backend.</p>
          <div className="prov-grid">
            {st.providers.map((x) => (
              <button key={x.id} className={`prov ${x.id === provider ? "on" : ""}`} onClick={() => (setProvider(x.id), setModel(x.defaultModel))}>
                <b>{x.label}</b>
                <span className="muted small">{x.notes}</span>
                {x.needsKey && <span className={`tag ${x.configured || keys[x.id] ? "ok" : ""}`}>{x.configured ? "clave en servidor" : keys[x.id] ? "clave en navegador" : "necesita clave"}</span>}
              </button>
            ))}
          </div>
          {p && (
            <div className="form">
              <label>
                Modelo
                <input list="models" value={model} onChange={(e) => setModel(e.target.value)} placeholder={p.defaultModel} />
                <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
              </label>
              {p.needsKey && (
                <label>
                  API key {p.signupUrl && <a href={p.signupUrl} target="_blank" rel="noreferrer">· consíguela gratis ↗</a>}
                  <input type="password" value={keys[p.id] ?? ""} onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value.trim() })} placeholder={p.configured ? `Usando ${p.envKey} del servidor` : "Pega aquí tu clave"} />
                </label>
              )}
            </div>
          )}
        </section>
        <section>
          <h3>Conector MCP</h3>
          <p className="muted">
            <b>{mcp.serverName}</b> · {mcp.tools.length} herramientas ({mcp.modelTools().length} visibles para el modelo) · {mcp.prompts.length} prompts.
            Puedes usar este mismo servidor desde Claude, ChatGPT, VS Code o MCPJam:
          </p>
          <pre className="code">{`URL (Streamable HTTP): ${mcpUrl}\n\n// Claude Desktop / stdio\n{ "mcpServers": { "finora": { "command": "npx", "args": ["tsx", "<ruta>/mcp-chat/src/bank/stdio.ts"] } } }`}</pre>
          <div className="row">
            <button
              className="btn"
              onClick={async () => {
                const r = await mcp.callTool("reiniciar_demo", {});
                setMsg(r.isError ? "Error al reiniciar" : "✓ Datos del banco restaurados");
              }}
            >
              Reiniciar datos del banco
            </button>
            <button className="btn danger" onClick={() => confirm("¿Borrar todas las conversaciones?") && (clearChats(), setMsg("✓ Conversaciones borradas"))}>
              Borrar conversaciones
            </button>
            <span className="muted small">{msg}</span>
          </div>
        </section>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
