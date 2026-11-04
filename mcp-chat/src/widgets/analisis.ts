import { ask, call, cat, eur, footer, fullscreenButton, h, header, mesCorto, mount, pct, render, sample, tellModel } from "./lib/runtime.ts";
import { bars, donut, legend } from "./lib/charts.ts";

interface Data {
  periodo: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  categoriaFiltrada: string | null;
  totalGastos: number;
  totalIngresos: number;
  tasaAhorro: number;
  mediaMensualGastos: number;
  porCategoria: { categoria: string; total: number; porcentaje: number; anterior: number; variacion: number | null }[];
  topComercios: { comercio: string; total: number; operaciones: number; categoria: string }[];
  meses: { mes: string; ingresos: number; gastos: number }[];
  periodosDisponibles: Record<string, string>;
}

let d: Data;
let cargando = false;
let ia: { estado: "idle" | "cargando" | "ok"; texto?: string } = { estado: "idle" };
let mesSel: number | null = null;

async function cargar(periodo: string, categoria?: string | null) {
  cargando = true;
  draw();
  const r = await call<Data>("analizar_gastos", { periodo, ...(categoria ? { categoria } : {}) });
  cargando = false;
  if (r.ok) {
    d = r.data;
    ia = { estado: "idle" };
    mesSel = null;
    tellModel(`La usuaria cambió el análisis de gastos a: ${d.etiqueta}${d.categoriaFiltrada ? `, categoría ${d.categoriaFiltrada}` : ""}. ${r.text}`);
  }
  draw();
}

async function explicar() {
  ia = { estado: "cargando" };
  draw();
  const resumen = `Periodo: ${d.etiqueta}. Gastos ${eur(d.totalGastos)}, ingresos ${eur(d.totalIngresos)}, tasa de ahorro ${d.tasaAhorro}%. Categorías: ${d.porCategoria
    .map((c) => `${c.categoria} ${eur(c.total)} (${c.variacion != null ? `${c.variacion > 0 ? "+" : ""}${c.variacion}% vs anterior` : "nuevo"})`)
    .join(", ")}. Top comercios: ${d.topComercios.map((c) => `${c.comercio} ${eur(c.total)}`).join(", ")}.`;
  const txt = await sample(
    `Analiza estos gastos de una clienta de banca y dame 3-4 viñetas breves (máx. 25 palabras cada una) con hallazgos concretos y un consejo de ahorro accionable. Responde en español, sin introducción.\n\n${resumen}`,
    "Eres un asesor financiero cercano y concreto.",
  );
  if (txt == null) {
    ia = { estado: "idle" };
    await ask(`Analiza mis gastos de ${d.etiqueta.toLowerCase()} y dame consejos concretos para ahorrar.`);
  } else ia = { estado: "ok", texto: txt };
  draw();
}

function draw() {
  const cats = d.porCategoria;
  const top = cats.slice(0, 7);
  const resto = cats.slice(7).reduce((s, c) => s + c.total, 0);
  const slices = [...top.map((c) => ({ label: c.categoria, value: c.total, color: cat(c.categoria).c })), ...(resto > 0 ? [{ label: "Otros", value: resto, color: "var(--ds-chart-4)" }] : [])];
  const mes = mesSel != null ? d.meses[mesSel] : null;

  render(
    header(d.categoriaFiltrada ? `Gastos en ${d.categoriaFiltrada}` : "Análisis de gastos", `${d.etiqueta} · ${d.desde} → ${d.hasta}`, fullscreenButton()),
    h(
      "div",
      { class: "chips scroll-x", style: { flexWrap: "nowrap", marginBottom: "12px" } },
      ...Object.entries(d.periodosDisponibles).map(([k, l]) => h("span", { class: `chip${k === d.periodo ? " on" : ""}`, onclick: () => cargar(k, d.categoriaFiltrada) }, l)),
      d.categoriaFiltrada ? h("span", { class: "chip", onclick: () => cargar(d.periodo, null) }, `✕ ${d.categoriaFiltrada}`) : null,
    ),
    h(
      "div",
      { class: "grid g3", style: { opacity: cargando ? ".5" : "1" } },
      kpi("Gastos", eur(d.totalGastos), `${eur(d.mediaMensualGastos)}/mes de media`),
      kpi("Ingresos", eur(d.totalIngresos), "Nómina y otros"),
      kpi("Tasa de ahorro", pct(d.tasaAhorro), d.tasaAhorro >= 20 ? "🟢 Excelente" : d.tasaAhorro >= 10 ? "🟡 Mejorable" : "🔴 Baja"),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px", opacity: cargando ? ".5" : "1" } },
      h("div", { class: "b", style: { marginBottom: "8px" } }, "¿En qué se va el dinero?"),
      h(
        "div",
        { class: "row wrap", style: { gap: "18px", alignItems: "center" } },
        donut(slices, {
          center: [eur(d.totalGastos, false), "gastado"],
          fmt: (n) => eur(n),
          onClick: (s) => s.label !== "Otros" && !d.categoriaFiltrada && cargar(d.periodo, s.label),
        }),
        h(
          "div",
          { class: "sp col", style: { gap: "7px", minWidth: "220px" } },
          ...top.map((c) =>
            h(
              "div",
              { class: "item click", style: { padding: "3px 4px", border: "0" }, title: "Ver detalle de la categoría", onclick: () => !d.categoriaFiltrada && cargar(d.periodo, c.categoria) },
              h("span", null, cat(c.categoria).e),
              h("div", { class: "sp" }, h("div", { class: "row small" }, h("span", { class: "sp" }, c.categoria), h("span", { class: "b num" }, eur(c.total, false))), h("div", { class: "bar", style: { height: "5px", marginTop: "3px" } }, h("i", { style: { width: `${c.porcentaje}%`, background: cat(c.categoria).c } }))),
              c.variacion != null ? h("span", { class: `badge ${c.variacion > 10 ? "bad" : c.variacion < -10 ? "ok" : ""}`, style: { minWidth: "52px", justifyContent: "center" } }, `${c.variacion > 0 ? "▲" : "▼"} ${Math.abs(Math.round(c.variacion))}%`) : h("span", { class: "badge" }, "nuevo"),
            ),
          ),
        ),
      ),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px" } },
      h("div", { class: "row" }, h("div", { class: "b" }, "Ingresos vs gastos por mes"), h("div", { class: "sp" }), legend([{ label: "Ingresos", color: "var(--ds-chart-1)" }, { label: "Gastos", color: "var(--ds-chart-2)" }])),
      bars(
        d.meses.map((m) => mesCorto(m.mes)),
        [
          { name: "Ingresos", color: "var(--ds-chart-1)", values: d.meses.map((m) => m.ingresos) },
          { name: "Gastos", color: "var(--ds-chart-2)", values: d.meses.map((m) => m.gastos) },
        ],
        { fmt: (n) => eur(n, false), highlight: mesSel ?? undefined, onClick: (i) => ((mesSel = mesSel === i ? null : i), draw()) },
      ),
      mes
        ? h(
            "div",
            { class: "row small fade", style: { marginTop: "6px" } },
            h("span", { class: "b" }, mesCorto(mes.mes)),
            h("span", { class: "muted" }, `Ingresos ${eur(mes.ingresos)} · Gastos ${eur(mes.gastos)} · Ahorro ${eur(mes.ingresos - mes.gastos)}`),
            h("span", { class: "sp" }),
            h("a", { class: "link", onclick: () => ask(`¿Por qué gasté ${eur(mes.gastos)} en ${mesCorto(mes.mes)} de ${mes.mes.slice(0, 4)}? Enséñame los movimientos más grandes de ese mes.`) }, "Preguntar →"),
          )
        : h("div", { class: "xs faint" }, "Pulsa una barra para ver el detalle del mes"),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px" } },
      h("div", { class: "b", style: { marginBottom: "4px" } }, "Dónde más gastas"),
      h(
        "div",
        { class: "list" },
        ...d.topComercios.map((c, i) =>
          h(
            "div",
            { class: "item click", onclick: () => ask(`Enséñame mis movimientos en ${c.comercio}`) },
            h("div", { class: "ava sm" }, String(i + 1)),
            h("div", { class: "sp ellipsis" }, h("div", null, c.comercio), h("div", { class: "xs muted" }, `${cat(c.categoria).e} ${c.categoria} · ${c.operaciones} operaciones`)),
            h("div", { class: "b num" }, eur(c.total)),
          ),
        ),
      ),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px", background: "linear-gradient(135deg, var(--brand-soft), transparent)" } },
      h("div", { class: "row" }, h("div", { class: "b" }, "✨ Análisis con IA"), h("div", { class: "sp" }), ia.estado !== "cargando" ? h("button", { class: "btn sm primary", onclick: explicar }, ia.estado === "ok" ? "Regenerar" : "Generar") : null),
      ia.estado === "cargando"
        ? h("div", { class: "col", style: { marginTop: "8px" } }, h("div", { class: "skel", style: { height: "14px" } }), h("div", { class: "skel", style: { height: "14px", width: "80%" } }), h("div", { class: "skel", style: { height: "14px", width: "60%" } }))
        : ia.estado === "ok"
          ? h("div", { class: "fade small", style: { whiteSpace: "pre-wrap", marginTop: "8px" } }, ia.texto)
          : h("div", { class: "small muted", style: { marginTop: "4px" } }, "El widget pide al modelo del chat (sampling) un resumen personalizado de estos datos."),
    ),
    footer(),
  );
}

const kpi = (lbl: string, val: string, sub: string) => h("div", { class: "card kpi" }, h("div", { class: "lbl" }, lbl), h("div", { class: "val", style: { fontSize: "19px" } }, val), h("div", { class: "xs faint" }, sub));

mount<Data>({
  onData: (x) => {
    d = x;
    draw();
  },
});
