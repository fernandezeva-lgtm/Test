import { ask, call, cat, downloadText, empty, eur, fecha, footer, fullscreenButton, h, header, mount, render, tabs, tellModel, toast } from "./lib/runtime.ts";

interface Mov {
  id: string;
  fecha: string;
  cuentaId: string;
  concepto: string;
  comercio: string;
  categoria: string;
  tipo: string;
  importe: number;
  saldo: number;
  tarjetaId?: string;
  estado: string;
  ubicacion?: string;
}
interface Data {
  filtros: Record<string, any>;
  total: number;
  paginas: number;
  totalIngresos: number;
  totalGastos: number;
  movimientos: Mov[];
  opciones: { cuentas: { id: string; alias: string }[]; tarjetas: { id: string; alias: string }[]; categorias: string[]; rangoFechas: { min: string; max: string } };
}

let data: Data;
let items: Mov[] = [];
let filtros: Record<string, any> = {};
let abierto: string | null = null;
let cargando = false;

function limpiar(f: Record<string, any>) {
  const o: Record<string, any> = {};
  for (const [k, v] of Object.entries(f)) if (v !== "" && v != null && k !== "pagina" && k !== "porPagina") o[k] = v;
  return o;
}

async function buscar(reset = true) {
  cargando = true;
  if (reset) draw();
  const pagina = reset ? 1 : (data.filtros.pagina ?? 1) + 1;
  const r = await call<Data>("buscar_movimientos", { ...limpiar(filtros), pagina, porPagina: 30 });
  cargando = false;
  if (!r.ok) return draw();
  data = r.data;
  items = reset ? data.movimientos : items.concat(data.movimientos);
  draw();
  if (reset) {
    const f = limpiar(filtros);
    tellModel(
      `La usuaria filtró los movimientos en el widget: ${Object.keys(f).length ? JSON.stringify(f) : "sin filtros"}. ${data.total} resultados, gastos ${eur(data.totalGastos)}, ingresos ${eur(data.totalIngresos)}.`,
      { filtros: f, total: data.total },
    );
  }
}

let debounce: ReturnType<typeof setTimeout>;
function setFiltro(k: string, v: unknown, inmediato = true) {
  filtros[k] = v;
  clearTimeout(debounce);
  debounce = setTimeout(() => buscar(true), inmediato ? 0 : 350);
}

async function csv() {
  const rows: Mov[] = [];
  for (let p = 1; p <= 10; p++) {
    const r = await call<Data>("buscar_movimientos", { ...limpiar(filtros), pagina: p, porPagina: 200 }, { silent: true });
    if (!r.ok) break;
    rows.push(...r.data.movimientos);
    if (p >= r.data.paginas) break;
  }
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const text = ["Fecha;Concepto;Comercio;Categoría;Importe;Saldo;Estado", ...rows.map((m) => [m.fecha, esc(m.concepto), esc(m.comercio), m.categoria, m.importe.toFixed(2).replace(".", ","), m.saldo.toFixed(2).replace(".", ","), m.estado].join(";"))].join("\n");
  await downloadText(`movimientos-finora-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv", "﻿" + text);
}

function detalle(m: Mov) {
  const cuenta = data.opciones.cuentas.find((c) => c.id === m.cuentaId)?.alias ?? m.cuentaId;
  const tarjeta = data.opciones.tarjetas.find((t) => t.id === m.tarjetaId)?.alias;
  const dias = (Date.now() - new Date(m.fecha + "T12:00:00").getTime()) / 86400000;
  const devolvible = m.tipo === "recibo" && m.estado === "completado" && m.importe < 0 && dias <= 56;
  const fila = (k: string, v: string) => h("div", { class: "row small" }, h("span", { class: "muted", style: { width: "110px" } }, k), h("span", { class: "sp" }, v));
  return h(
    "div",
    { class: "card soft fade", style: { margin: "2px 0 8px 44px" } },
    fila("Fecha", fecha(m.fecha, { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
    fila("Cuenta", cuenta),
    tarjeta ? fila("Tarjeta", tarjeta) : null,
    fila("Comercio", m.comercio),
    m.ubicacion ? fila(m.tipo === "bizum" ? "Concepto" : "Ubicación", m.ubicacion) : null,
    fila("Saldo después", eur(m.saldo)),
    fila("Referencia", m.id),
    h(
      "div",
      { class: "row wrap", style: { marginTop: "10px", gap: "6px" } },
      h("button", { class: "btn sm", onclick: () => ask(`Explícame este movimiento: ${m.concepto} de ${eur(m.importe)} del ${m.fecha} (ref ${m.id}). ¿Es normal comparado con mis gastos habituales?`) }, "💬 Preguntar al asistente"),
      devolvible
        ? h(
            "button",
            {
              class: "btn sm",
              onclick: async (e: Event) => {
                (e.target as HTMLButtonElement).disabled = true;
                const r = await call("devolver_recibo", { movimientoId: m.id, motivo: "Solicitado desde el listado" });
                if (r.ok) {
                  toast(r.text);
                  tellModel(`La usuaria devolvió el recibo ${m.comercio} (${eur(m.importe)}).`);
                  buscar(true);
                }
              },
            },
            "↩️ Devolver recibo",
          )
        : null,
      m.importe < 0 && m.tipo === "tarjeta" ? h("button", { class: "btn sm", onclick: () => ask(`No reconozco el cargo "${m.concepto}" de ${eur(m.importe)} del ${m.fecha} con mi tarjeta ${tarjeta ?? ""}. ¿Qué hago?`) }, "🚩 No lo reconozco") : null,
      m.tipo === "bizum" && m.importe < 0 ? h("button", { class: "btn sm", onclick: () => ask(`Repite el Bizum a ${m.comercio} de ${Math.abs(m.importe)} euros`) }, "🔁 Repetir Bizum") : null,
    ),
  );
}

function draw() {
  const o = data.opciones;
  const sel = (k: string, opts: [string, string][], ph: string) =>
    h(
      "select",
      { class: "inp", style: { width: "auto", flex: "1 1 130px", padding: "6px 8px", fontSize: "13px" }, onchange: (e: Event) => setFiltro(k, (e.target as HTMLSelectElement).value) },
      h("option", { value: "" }, ph),
      ...opts.map(([v, l]) => h("option", { value: v, selected: filtros[k] === v }, l)),
    );
  const busq = h("input", {
    class: "inp",
    placeholder: "🔍 Buscar comercio o concepto…",
    value: filtros.texto ?? "",
    style: { flex: "2 1 180px", padding: "6px 10px", fontSize: "13px" },
    oninput: (e: Event) => setFiltro("texto", (e.target as HTMLInputElement).value, false),
  });
  const fechaInp = (k: string) =>
    h("input", { class: "inp", type: "date", value: filtros[k] ?? "", min: o.rangoFechas.min, max: o.rangoFechas.max, style: { flex: "1 1 120px", padding: "5px 8px", fontSize: "13px" }, onchange: (e: Event) => setFiltro(k, (e.target as HTMLInputElement).value) });

  // Agrupar por fecha
  const grupos = new Map<string, Mov[]>();
  for (const m of items) grupos.set(m.fecha, [...(grupos.get(m.fecha) ?? []), m]);
  const hayFiltros = Object.keys(limpiar(filtros)).length > 0;

  render(
    header("Movimientos", `${data.total.toLocaleString("es-ES")} resultados · últimos 2 años`, h("button", { class: "btn ghost sm", title: "Descargar CSV", onclick: csv }, "⬇️ CSV"), fullscreenButton()),
    h(
      "div",
      { class: "grid g2", style: { marginBottom: "10px" } },
      h("div", { class: "card soft kpi" }, h("div", { class: "lbl" }, "Gastos"), h("div", { class: "val", style: { fontSize: "18px" } }, eur(data.totalGastos))),
      h("div", { class: "card soft kpi" }, h("div", { class: "lbl" }, "Ingresos"), h("div", { class: "val pos", style: { fontSize: "18px" } }, eur(data.totalIngresos))),
    ),
    h("div", { class: "row wrap", style: { gap: "6px", marginBottom: "8px" } }, busq, sel("categoria", o.categorias.map((c) => [c, `${cat(c).e} ${c}`]), "Todas las categorías"), sel("cuentaId", o.cuentas.map((c) => [c.id, c.alias]), "Todas las cuentas")),
    h(
      "div",
      { class: "row wrap", style: { gap: "6px", marginBottom: "10px" } },
      tabs(
        [
          ["todos", "Todos"],
          ["gastos", "Gastos"],
          ["ingresos", "Ingresos"],
        ],
        filtros.tipo ?? "todos",
        (v) => setFiltro("tipo", v === "todos" ? "" : v),
      ),
      fechaInp("desde"),
      h("span", { class: "faint" }, "→"),
      fechaInp("hasta"),
      hayFiltros ? h("button", { class: "btn ghost sm", onclick: () => ((filtros = {}), buscar(true)) }, "✕ Limpiar") : null,
    ),
    cargando && !items.length
      ? h("div", { class: "skel", style: { height: "200px" } })
      : !items.length
        ? empty("🔎", "No hay movimientos con esos filtros.")
        : h(
            "div",
            { class: "list", style: { opacity: cargando ? ".5" : "1" } },
            ...[...grupos.entries()].flatMap(([f, ms]) => [
              h("div", { class: "xs b faint", style: { padding: "10px 4px 2px", textTransform: "uppercase", letterSpacing: ".04em" } }, fecha(f, { weekday: "short", day: "numeric", month: "short", year: "numeric" })),
              ...ms.flatMap((m) => [
                h(
                  "div",
                  { class: "item click", onclick: () => ((abierto = abierto === m.id ? null : m.id), draw()) },
                  h("div", { class: "ava", style: { background: `color-mix(in srgb, ${cat(m.categoria).c} 16%, transparent)` } }, cat(m.categoria).e),
                  h(
                    "div",
                    { class: "sp ellipsis" },
                    h("div", { class: "ellipsis", style: { fontWeight: "550" } }, m.concepto),
                    h(
                      "div",
                      { class: "xs muted row", style: { gap: "6px" } },
                      m.categoria,
                      m.estado === "pendiente" ? h("span", { class: "badge warn" }, "Pendiente") : null,
                      m.estado === "devuelto" ? h("span", { class: "badge info" }, "Devuelto") : null,
                      m.ubicacion && m.ubicacion !== "Madrid" && m.tipo === "tarjeta" ? h("span", { class: "faint" }, `· ${m.ubicacion}`) : null,
                    ),
                  ),
                  h("div", { class: "right" }, h("div", { class: `b num ${m.importe > 0 ? "pos" : ""}` }, `${m.importe > 0 ? "+" : ""}${eur(m.importe)}`), h("div", { class: "xs faint num" }, eur(m.saldo))),
                ),
                abierto === m.id ? detalle(m) : null,
              ]),
            ]),
          ),
    items.length < data.total
      ? h("button", { class: "btn block", style: { marginTop: "10px" }, disabled: cargando, onclick: () => buscar(false) }, cargando ? "Cargando…" : `Cargar más (${data.total - items.length} restantes)`)
      : null,
    footer(),
  );
}

mount<Data>({
  onData: (d) => {
    data = d;
    items = d.movimientos;
    filtros = limpiar(d.filtros ?? {});
    draw();
  },
});
