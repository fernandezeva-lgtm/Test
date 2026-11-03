import { ask, eur, footer, fullscreenButton, h, header, mesCorto, mount, pct, render } from "./lib/runtime.ts";
import { donut, legend, line } from "./lib/charts.ts";

interface Inv {
  id: string;
  tipo: string;
  nombre: string;
  isin?: string;
  valor: number;
  aportado: number;
  riesgo: number;
  rentabilidad: number;
  ganancia: number;
  historico: { fecha: string; valor: number }[];
}
interface Data {
  inversiones: Inv[];
  total: number;
  aportado: number;
  serie: { fecha: string; valor: number }[];
}

let d: Data;
let rango: 6 | 12 | 24 = 24;
const COL = ["#6366f1", "#a855f7", "#0ea5e9"];

function draw() {
  const serie = d.serie.slice(-rango - 1);
  const ganancia = d.total - d.aportado;
  const varRango = serie[serie.length - 1].valor - serie[0].valor;
  render(
    header("Mis inversiones", `${d.inversiones.length} productos`, fullscreenButton()),
    h(
      "div",
      { class: "card row wrap", style: { gap: "16px" } },
      h(
        "div",
        { class: "sp kpi" },
        h("div", { class: "lbl" }, "Valor de la cartera"),
        h("div", { class: "val big" }, eur(d.total)),
        h("div", { class: `delta ${ganancia >= 0 ? "pos" : ""}` }, `${ganancia >= 0 ? "▲" : "▼"} ${eur(Math.abs(ganancia))} (${pct((ganancia / d.aportado) * 100)}) sobre lo aportado`),
      ),
      donut(
        d.inversiones.map((i, k) => ({ label: i.nombre, value: i.valor, color: COL[k % COL.length] })),
        { size: 110, thickness: 16, fmt: (n) => eur(n, false) },
      ),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px" } },
      h(
        "div",
        { class: "row" },
        h("div", { class: "b" }, "Evolución"),
        h("span", { class: `badge ${varRango >= 0 ? "ok" : "bad"}` }, `${varRango >= 0 ? "+" : ""}${eur(varRango, false)}`),
        h("div", { class: "sp" }),
        h("div", { class: "tabs" }, ...([6, 12, 24] as const).map((r) => h("button", { class: `tab${r === rango ? " on" : ""}`, onclick: () => ((rango = r), draw()) }, `${r}M`))),
      ),
      line(
        serie.map((p) => mesCorto(p.fecha.slice(0, 7))),
        [{ name: "Cartera", color: "#6366f1", values: serie.map((p) => p.valor) }],
        { area: true, fmt: (n) => eur(n, false), height: 180 },
      ),
    ),
    h(
      "div",
      { class: "col", style: { marginTop: "10px" } },
      ...d.inversiones.map((i, k) =>
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "row" },
            h("div", { class: "ava", style: { background: `color-mix(in srgb, ${COL[k]} 18%, transparent)` } }, i.tipo === "fondo" ? "🌍" : "🧓"),
            h("div", { class: "sp" }, h("div", { class: "b" }, i.nombre), h("div", { class: "xs muted" }, `${i.isin ? `ISIN ${i.isin} · ` : ""}Aportado ${eur(i.aportado, false)}`)),
            h("div", { class: "right" }, h("div", { class: "b num" }, eur(i.valor)), h("span", { class: `badge ${i.rentabilidad >= 0 ? "ok" : "bad"}` }, `${i.rentabilidad >= 0 ? "+" : ""}${pct(i.rentabilidad)}`)),
          ),
          h(
            "div",
            { class: "row small", style: { marginTop: "8px", gap: "4px" } },
            h("span", { class: "muted" }, "Riesgo"),
            ...Array.from({ length: 7 }, (_, n) => h("span", { style: { width: "18px", height: "6px", borderRadius: "3px", background: n < i.riesgo ? (i.riesgo >= 5 ? "#ef4444" : i.riesgo >= 4 ? "#f59e0b" : "#10b981") : "var(--bg3)" } })),
            h("span", { class: "faint" }, `${i.riesgo}/7`),
            h("span", { class: "sp" }),
            h("a", { class: "link", onclick: () => ask(`¿Debería aumentar mi aportación al ${i.nombre}? Explícame pros y contras según mi perfil.`) }, "Consejo →"),
          ),
        ),
      ),
    ),
    legend(d.inversiones.map((i, k) => ({ label: i.nombre, color: COL[k % COL.length], value: pct((i.valor / d.total) * 100, 0) }))),
    h("div", { class: "xs faint", style: { marginTop: "8px" } }, "Rentabilidades pasadas no garantizan rentabilidades futuras."),
    footer(),
  );
}

mount<Data>({
  onData: (x) => {
    d = x;
    draw();
  },
});
