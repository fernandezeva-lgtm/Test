import { ask, call, eur, fecha, footer, h, header, mount, render, tellModel, toast } from "./lib/runtime.ts";
import { ring } from "./lib/charts.ts";

interface Obj {
  id: string;
  nombre: string;
  emoji: string;
  meta: number;
  ahorrado: number;
  fechaObjetivo: string;
  aportacionMensual: number;
  progreso: number;
  faltan: number;
  aportacionNecesaria: number;
  enCamino: boolean;
}
interface Data {
  objetivos: Obj[];
  saldoAhorro: number;
}

let d: Data;
let aportando: string | null = null;
let creando = false;
const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#0ea5e9", "#a855f7"];

async function aportar(o: Obj, importe: number) {
  const r = await call<Data & { mensaje: string }>("aportar_objetivo", { objetivoId: o.id, importe });
  if (r.ok) {
    d = { objetivos: r.data.objetivos, saldoAhorro: r.data.saldoAhorro };
    aportando = null;
    toast(r.data.mensaje);
    tellModel(`La usuaria aportó ${eur(importe)} al objetivo "${o.nombre}". ${r.data.mensaje}`);
    const nuevo = d.objetivos.find((x) => x.id === o.id);
    if (nuevo && nuevo.progreso >= 100) toast(`🎉 ¡Objetivo "${o.nombre}" conseguido!`);
  }
  draw();
}

function draw() {
  const total = d.objetivos.reduce((s, o) => s + o.ahorrado, 0);
  const meta = d.objetivos.reduce((s, o) => s + o.meta, 0);
  render(
    header("Objetivos de ahorro", `${eur(total, false)} ahorrados de ${eur(meta, false)}`, h("button", { class: "btn sm primary", onclick: () => ((creando = !creando), draw()) }, creando ? "Cancelar" : "+ Nuevo")),
    creando ? nuevoForm() : null,
    h(
      "div",
      { class: "col" },
      ...d.objetivos.map((o, i) =>
        h(
          "div",
          { class: "card fade" },
          h(
            "div",
            { class: "row", style: { gap: "14px" } },
            ring(o.progreso, COLORS[i % COLORS.length], 68),
            h(
              "div",
              { class: "sp" },
              h("div", { class: "b", style: { fontSize: "15px" } }, `${o.emoji} ${o.nombre}`),
              h("div", { class: "small muted num" }, `${eur(o.ahorrado, false)} de ${eur(o.meta, false)} · faltan ${eur(o.faltan, false)}`),
              h("div", { class: "row xs", style: { marginTop: "4px", gap: "6px" } }, h("span", { class: `badge ${o.enCamino ? "ok" : "warn"}` }, o.enCamino ? "✓ En camino" : `Necesitas ${eur(o.aportacionNecesaria, false)}/mes`), h("span", { class: "faint" }, `🗓️ ${fecha(o.fechaObjetivo, { month: "short", year: "numeric" })}`)),
            ),
            h("button", { class: "btn sm", onclick: () => ((aportando = aportando === o.id ? null : o.id), draw()) }, "Aportar"),
          ),
          aportando === o.id
            ? h(
                "div",
                { class: "row wrap fade", style: { marginTop: "10px", gap: "6px" } },
                ...[25, 50, 100, 250].map((n) => h("button", { class: "chip", onclick: () => aportar(o, n) }, `+${n} €`)),
                (() => {
                  const inp = h("input", { class: "inp", inputmode: "decimal", placeholder: "Otro importe", style: { width: "110px", padding: "5px 8px" } });
                  return [inp, h("button", { class: "btn primary sm", onclick: () => Number(inp.value.replace(",", ".")) > 0 && aportar(o, Number(inp.value.replace(",", "."))) }, "Aportar")];
                })(),
              )
            : null,
        ),
      ),
    ),
    h("div", { class: "chips", style: { marginTop: "12px" } }, h("span", { class: "chip", onclick: () => ask("¿Cuánto debería ahorrar al mes para llegar a todos mis objetivos? Ten en cuenta mis gastos.") }, "✨ ¿Cuánto debo ahorrar al mes?")),
    footer(h("span", null, `Cuenta Ahorro: ${eur(d.saldoAhorro)}`)),
  );
}

function nuevoForm() {
  const nombre = h("input", { class: "inp", placeholder: "Ej. Máster, boda, sofá nuevo…" });
  const meta = h("input", { class: "inp", inputmode: "decimal", placeholder: "3000" });
  const fechaI = h("input", { class: "inp", type: "date", min: new Date().toISOString().slice(0, 10) });
  let emoji = "🎯";
  const emojis = h("div", { class: "chips" });
  const pintaEmojis = () => emojis.replaceChildren(...["🎯", "🏖️", "🎓", "💍", "🛋️", "🏍️", "🐶", "💻"].map((e) => h("span", { class: `chip${e === emoji ? " on" : ""}`, onclick: () => ((emoji = e), pintaEmojis()) }, e)));
  pintaEmojis();
  const err = h("div", { class: "hint err" });
  return h(
    "div",
    { class: "card fade col", style: { marginBottom: "10px" } },
    h("label", { class: "f" }, "Nombre", nombre),
    emojis,
    h("div", { class: "grid g2" }, h("label", { class: "f" }, "Meta (€)", meta), h("label", { class: "f" }, "Fecha objetivo", fechaI)),
    err,
    h(
      "button",
      {
        class: "btn primary",
        onclick: async () => {
          const m = Number(meta.value.replace(",", "."));
          if (!nombre.value.trim() || !m || !fechaI.value) return (err.textContent = "Completa nombre, meta y fecha");
          const meses = Math.max(1, Math.round((new Date(fechaI.value).getTime() - Date.now()) / (30.4 * 86400000)));
          const r = await call<Data & { mensaje: string }>("crear_objetivo", { nombre: nombre.value.trim(), emoji, meta: m, fechaObjetivo: fechaI.value, aportacionMensual: Math.ceil(m / meses) });
          if (r.ok) {
            d = { objetivos: r.data.objetivos, saldoAhorro: r.data.saldoAhorro };
            creando = false;
            toast(r.data.mensaje);
            tellModel(`La usuaria creó el objetivo "${nombre.value}" de ${eur(m)} para ${fechaI.value}.`);
            draw();
          }
        },
      },
      "Crear objetivo",
    ),
  );
}

mount<Data>({
  onData: (x) => {
    d = x;
    draw();
  },
});
