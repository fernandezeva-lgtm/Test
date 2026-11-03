import { ask, call, footer, fullscreenButton, h, header, mount, otpPanel, render, successPanel, tellModel } from "./lib/runtime.ts";

interface Producto {
  id: string;
  tipo: string;
  nombre: string;
  resumen: string;
  ventajas: string[];
  condiciones: Record<string, string>;
  badge?: string;
  icono: string;
  color: string;
  contratado?: boolean;
  solicitado?: boolean;
}
interface Data {
  productos: Producto[];
  tipos: string[];
  filtro: string | null;
}

const TIPOS: Record<string, string> = { cuenta: "🏦 Cuentas", deposito: "🔒 Depósitos", tarjeta: "💳 Tarjetas", prestamo: "💶 Préstamos", hipoteca: "🏠 Hipotecas", inversion: "📈 Inversión", seguro: "🛡️ Seguros" };
const BADGE: Record<string, string> = { Nuevo: "info", "Más popular": "warn", "Recomendado para ti": "ok", Oferta: "bad" };

let d: Data;
let filtro: string | null = null;
let solicitando: Producto | null = null;
let hecho: string | null = null;

function card(p: Producto) {
  return h(
    "div",
    { class: "card fade", style: { padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" } },
    h(
      "div",
      { style: { background: `linear-gradient(135deg, ${p.color}, color-mix(in srgb, ${p.color} 60%, white))`, color: "white", padding: "12px 14px", position: "relative" } },
      h("div", { style: { fontSize: "26px" } }, p.icono),
      h("div", { class: "b", style: { fontSize: "15px", marginTop: "4px" } }, p.nombre),
      p.badge ? h("span", { class: `badge ${BADGE[p.badge] ?? ""}`, style: { position: "absolute", top: "10px", right: "10px", boxShadow: "0 1px 4px rgb(0 0 0 / .2)" } }, p.badge === "Recomendado para ti" ? "⭐ " + p.badge : p.badge) : null,
    ),
    h(
      "div",
      { style: { padding: "12px 14px", flex: "1", display: "flex", flexDirection: "column", gap: "8px" } },
      h("div", { class: "small muted" }, p.resumen),
      h("div", { class: "col", style: { gap: "3px" } }, ...p.ventajas.map((v) => h("div", { class: "small" }, h("span", { class: "pos b" }, "✓ "), v))),
      h(
        "details",
        { class: "small" },
        h("summary", { class: "link", style: { cursor: "pointer" } }, "Condiciones"),
        h("table", { class: "t", style: { marginTop: "4px" } }, ...Object.entries(p.condiciones).map(([k, v]) => h("tr", null, h("td", { class: "muted" }, k), h("td", { class: "b right" }, v)))),
      ),
      h("div", { class: "sp" }),
      h(
        "div",
        { class: "row", style: { gap: "6px" } },
        p.contratado
          ? h("span", { class: "badge ok", style: { padding: "6px 10px" } }, p.solicitado ? "✓ Solicitado" : "✓ Ya lo tienes")
          : h("button", { class: "btn primary sm", onclick: () => (["prestamo", "hipoteca"].includes(p.tipo) ? ask(`Simula el ${p.nombre}`) : ((solicitando = p), draw())) }, ["prestamo", "hipoteca"].includes(p.tipo) ? "Simular" : "Contratar"),
        h("button", { class: "btn sm", onclick: () => ask(`Cuéntame más sobre ${p.nombre}. ¿Me conviene según mi perfil?`) }, "¿Me conviene?"),
      ),
    ),
  );
}

function draw() {
  if (hecho) return render(header("Catálogo", "Solicitud enviada"), successPanel("¡Hecho!", hecho, h("button", { class: "btn", onclick: () => ((hecho = null), draw()) }, "Volver al catálogo")), footer());
  if (solicitando) {
    const p = solicitando;
    const { panel, setError } = otpPanel(
      h("div", { class: "card soft row" }, h("div", { style: { fontSize: "28px" } }, p.icono), h("div", { class: "sp" }, h("div", { class: "b" }, p.nombre), h("div", { class: "small muted" }, Object.entries(p.condiciones).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ")))),
      async (otp) => {
        const r = await call<{ mensaje: string }>("solicitar_producto", { productoId: p.id, otp }, { silent: true });
        if (!r.ok) {
          setError(r.text);
          return false;
        }
        p.contratado = true;
        p.solicitado = true;
        solicitando = null;
        hecho = r.text;
        tellModel(`La usuaria contrató/solicitó ${p.nombre}: ${r.text}`);
        draw();
        return true;
      },
      () => ((solicitando = null), draw()),
    );
    return render(header(`Contratar ${p.nombre}`, "Lee las condiciones y firma"), panel, footer());
  }
  const lista = d.productos.filter((p) => !filtro || p.tipo === filtro);
  render(
    header("Productos Finora", `${d.productos.length} productos · ${d.productos.filter((p) => p.contratado).length} contratados`, fullscreenButton()),
    h(
      "div",
      { class: "chips scroll-x", style: { flexWrap: "nowrap", marginBottom: "12px" } },
      h("span", { class: `chip${!filtro ? " on" : ""}`, onclick: () => ((filtro = null), draw()) }, "Todos"),
      ...Object.entries(TIPOS)
        .filter(([t]) => d.productos.some((p) => p.tipo === t))
        .map(([t, l]) => h("span", { class: `chip${filtro === t ? " on" : ""}`, onclick: () => ((filtro = t), draw()) }, l)),
    ),
    h("div", { class: "grid", style: { gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" } }, ...lista.map(card)),
    footer(),
  );
}

mount<Data>({
  onData: (x) => {
    d = x;
    filtro = x.filtro;
    draw();
  },
});
