import { ask, call, eur, footer, h, header, mount, otpPanel, pct, render, successPanel, tabs, tellModel } from "./lib/runtime.ts";
import { bars, legend } from "./lib/charts.ts";

interface Sim {
  producto: { id: string; nombre: string; tin: number; tae?: number };
  tipo: "personal" | "coche" | "hipoteca";
  importe: number;
  plazoMeses: number;
  cuota: number;
  totalIntereses: number;
  totalPagar: number;
  cuadroAnual: { anio: number; intereses: number; amortizado: number; pendiente: number }[];
  endeudamiento: number;
  viable: boolean;
  preconcedido: number | null;
  limites: { importeMin: number; importeMax: number; plazoMin: number; plazoMax: number; paso: number };
}

let s: Sim;
let paso: "sim" | "firma" | "hecho" = "sim";
let resultado = "";
let t: ReturnType<typeof setTimeout>;
let seq = 0;

async function recalcular(tipo: string, importe?: number, plazoMeses?: number) {
  const my = ++seq;
  const r = await call<Sim>("simular_prestamo", { tipo, ...(importe && { importe }), ...(plazoMeses && { plazoMeses }) }, { silent: true });
  if (!r.ok || my !== seq) return;
  s = r.data;
  draw();
  clearTimeout(t);
  t = setTimeout(() => tellModel(`La usuaria ajustó el simulador: ${r.text}`), 800);
}

function draw() {
  if (paso === "hecho") return render(header("Simulador", "Solicitud completada"), successPanel("¡Solicitud enviada!", resultado), footer());
  if (paso === "firma") {
    const { panel, setError } = otpPanel(
      h("div", { class: "card soft col", style: { gap: "4px" } }, h("div", { class: "b" }, s.producto.nombre), h("div", { class: "small muted" }, `${eur(s.importe, false)} · ${s.plazoMeses} meses · TIN ${s.producto.tin}%`), h("div", { class: "row" }, h("span", { class: "sp" }, "Cuota mensual"), h("span", { class: "b num", style: { fontSize: "20px" } }, eur(s.cuota)))),
      async (otp) => {
        const r = await call("solicitar_producto", { productoId: s.producto.id, detalle: { importe: s.importe, plazoMeses: s.plazoMeses, cuota: s.cuota }, otp }, { silent: true });
        if (!r.ok) {
          setError(r.text);
          return false;
        }
        resultado = r.text;
        paso = "hecho";
        tellModel(`La usuaria solicitó con firma ${s.producto.nombre} de ${eur(s.importe)} a ${s.plazoMeses} meses: ${r.text}`);
        draw();
        return true;
      },
      () => ((paso = "sim"), draw()),
    );
    return render(header("Solicitar financiación", "Firma la solicitud"), panel, footer());
  }

  const L = s.limites;
  const importeEl = h("span", { class: "b num" }, eur(s.importe, false));
  const plazoEl = h("span", { class: "b num" }, plazoTxt(s.plazoMeses));
  const deb = (fn: () => void) => {
    clearTimeout((deb as any).t);
    (deb as any).t = setTimeout(fn, 120);
  };
  let imp = s.importe;
  let pl = s.plazoMeses;
  const colorEnd = s.endeudamiento < 30 ? "var(--ok)" : s.endeudamiento < 40 ? "var(--warn)" : "var(--bad)";

  render(
    header("Simulador de financiación", s.producto.nombre),
    tabs(
      [
        ["personal", "💶 Personal"],
        ["coche", "🚗 Coche"],
        ["hipoteca", "🏠 Hipoteca"],
      ],
      s.tipo,
      (v) => recalcular(v),
    ),
    s.preconcedido && s.importe <= s.preconcedido ? h("div", { class: "banner exito", style: { marginTop: "10px" } }, h("span", { class: "ico" }, "🎉"), h("div", null, h("div", { class: "t" }, `Tienes ${eur(s.preconcedido, false)} preconcedidos`), "Sin papeles: el dinero llega a tu cuenta al momento.")) : null,
    h(
      "div",
      { class: "card", style: { marginTop: "12px" } },
      h(
        "label",
        { class: "f" },
        h("span", { class: "row" }, h("span", { class: "sp" }, "Importe"), importeEl),
        h("input", {
          type: "range",
          min: String(L.importeMin),
          max: String(L.importeMax),
          step: String(L.paso),
          value: String(s.importe),
          oninput: (e: Event) => {
            imp = Number((e.target as HTMLInputElement).value);
            importeEl.textContent = eur(imp, false);
            deb(() => recalcular(s.tipo, imp, pl));
          },
        }),
      ),
      h(
        "label",
        { class: "f", style: { marginTop: "10px" } },
        h("span", { class: "row" }, h("span", { class: "sp" }, "Plazo"), plazoEl),
        h("input", {
          type: "range",
          min: String(L.plazoMin),
          max: String(L.plazoMax),
          step: s.tipo === "hipoteca" ? "12" : "6",
          value: String(s.plazoMeses),
          oninput: (e: Event) => {
            pl = Number((e.target as HTMLInputElement).value);
            plazoEl.textContent = plazoTxt(pl);
            deb(() => recalcular(s.tipo, imp, pl));
          },
        }),
      ),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px", textAlign: "center", background: "linear-gradient(135deg, var(--brand-soft), transparent)" } },
      h("div", { class: "small muted" }, "Cuota mensual"),
      h("div", { class: "num", style: { fontSize: "34px", fontWeight: "800", letterSpacing: "-.02em" } }, eur(s.cuota)),
      h("div", { class: "small muted" }, `TIN ${pct(s.producto.tin, 2)}${s.producto.tae ? ` · TAE ${pct(s.producto.tae, 2)}` : ""}`),
    ),
    h(
      "div",
      { class: "grid g3", style: { marginTop: "10px" } },
      kpi("Intereses totales", eur(s.totalIntereses)),
      kpi("Total a pagar", eur(s.totalPagar)),
      h(
        "div",
        { class: "card kpi" },
        h("div", { class: "lbl" }, "Endeudamiento"),
        h("div", { class: "val", style: { fontSize: "17px", color: colorEnd } }, pct(s.endeudamiento)),
        h("div", { class: "bar", style: { height: "5px", marginTop: "4px" } }, h("i", { style: { width: `${Math.min(100, s.endeudamiento / 0.6)}%`, background: colorEnd } })),
        h("div", { class: "xs faint" }, s.viable ? "Dentro del 40% recomendado" : "Supera el 40% recomendado"),
      ),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px" } },
      h("div", { class: "row" }, h("div", { class: "b" }, "Cuadro de amortización (anual)"), h("div", { class: "sp" }), legend([{ label: "Capital", color: "var(--ds-chart-1)" }, { label: "Intereses", color: "var(--ds-chart-2)" }])),
      bars(
        s.cuadroAnual.map((c) => `${c.anio}`),
        [
          { name: "Capital", color: "var(--ds-chart-1)", values: s.cuadroAnual.map((c) => c.amortizado) },
          { name: "Intereses", color: "var(--ds-chart-2)", values: s.cuadroAnual.map((c) => c.intereses) },
        ],
        { stacked: true, fmt: (n) => eur(n, false), height: 170 },
      ),
      h("div", { class: "xs faint", style: { textAlign: "center" } }, "Año del préstamo"),
    ),
    h(
      "div",
      { class: "row", style: { marginTop: "12px", gap: "8px" } },
      h("button", { class: "btn primary", style: { flex: "1" }, disabled: !s.viable, onclick: () => ((paso = "firma"), draw()) }, s.tipo === "hipoteca" ? "Solicitar estudio" : "Solicitar ahora"),
      h("button", { class: "btn", onclick: () => ask(`¿Me conviene más reducir el plazo o el importe de este ${s.producto.nombre} de ${eur(s.importe, false)} a ${s.plazoMeses} meses?`) }, "💬 Consejo"),
    ),
    h("div", { class: "xs faint", style: { marginTop: "8px" } }, "Simulación orientativa sin valor contractual. Sujeta a aprobación."),
    footer(),
  );
}

const plazoTxt = (m: number) => (m % 12 === 0 ? `${m / 12} años` : `${m} meses`);
const kpi = (lbl: string, val: string) => h("div", { class: "card kpi" }, h("div", { class: "lbl" }, lbl), h("div", { class: "val", style: { fontSize: "17px" } }, val));

mount<Sim>({
  onData: (x) => {
    s = x;
    draw();
  },
});
