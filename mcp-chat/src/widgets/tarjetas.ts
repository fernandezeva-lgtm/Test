import { ask, call, eur, fechaCorta, footer, h, header, mount, otpPanel, render, tellModel, toast, toggle } from "./lib/runtime.ts";

interface Tarjeta {
  id: string;
  alias: string;
  tipo: "debito" | "credito" | "virtual";
  red: string;
  numero: string;
  titular: string;
  caducidad: string;
  color: string;
  bloqueada: boolean;
  comprasOnline: boolean;
  pagosExtranjero: boolean;
  contactless: boolean;
  limiteDiario: number;
  limiteCajero: number;
  limiteCredito?: number;
  dispuesto?: number;
  gastoMes: number;
  ultimos: { id: string; fecha: string; concepto: string; importe: number; ubicacion?: string }[];
}
interface Data {
  tarjetas: Tarjeta[];
  destacada: string | null;
  accionSugerida: string | null;
}

let d: Data;
let sel = 0;
let verPin: "no" | "firma" | "si" = "no";
let limites: { diario: number; cajero: number } | null = null;

async function cambiar(t: Tarjeta, cambios: Partial<Tarjeta>) {
  const r = await call<{ tarjeta: Tarjeta; mensaje: string }>("actualizar_tarjeta", { tarjetaId: t.id, ...cambios });
  if (r.ok) {
    Object.assign(t, r.data.tarjeta);
    toast(r.data.mensaje);
    tellModel(`La usuaria cambió la tarjeta ${t.alias}: ${JSON.stringify(cambios)}. Estado: ${t.bloqueada ? "bloqueada" : "activa"}, online ${t.comprasOnline}, extranjero ${t.pagosExtranjero}, contactless ${t.contactless}, límite diario ${t.limiteDiario}, cajero ${t.limiteCajero}.`);
    if (d.accionSugerida === "bloquear" && cambios.bloqueada) d.accionSugerida = null;
  }
  draw();
}

function cardVisual(t: Tarjeta) {
  return h(
    "div",
    {
      style: {
        background: t.color,
        color: "white",
        borderRadius: "16px",
        padding: "16px 18px",
        aspectRatio: "1.586",
        maxWidth: "330px",
        width: "100%",
        margin: "0 auto",
        position: "relative",
        boxShadow: "0 10px 30px -10px rgb(0 0 0 / .45)",
        filter: t.bloqueada ? "grayscale(.85)" : "none",
        transition: "filter .3s",
        display: "flex",
        flexDirection: "column",
      },
    },
    h("div", { class: "row" }, h("span", { class: "b" }, "Finora"), h("span", { class: "sp" }), h("span", { class: "small", style: { opacity: ".9" } }, t.tipo === "credito" ? "CRÉDITO" : t.tipo === "virtual" ? "VIRTUAL" : "DÉBITO")),
    h("div", { style: { width: "38px", height: "28px", borderRadius: "6px", background: "linear-gradient(135deg,#fde68a,#d97706)", marginTop: "14px", opacity: t.tipo === "virtual" ? "0" : "1" } }),
    h("div", { class: "num", style: { fontSize: "19px", letterSpacing: "2px", marginTop: "auto" } }, t.numero),
    h("div", { class: "row small", style: { marginTop: "8px", opacity: ".92" } }, h("span", { class: "sp" }, t.titular), h("span", null, t.caducidad), h("span", { class: "b", style: { fontStyle: "italic", fontSize: "15px" } }, t.red)),
    t.bloqueada ? h("div", { style: { position: "absolute", inset: "0", display: "grid", placeItems: "center", fontSize: "15px", fontWeight: "700", background: "rgb(0 0 0 / .35)", borderRadius: "16px" } }, "🔒 BLOQUEADA TEMPORALMENTE") : null,
  );
}

function control(icono: string, titulo: string, sub: string, valor: boolean, onChange: (v: boolean) => void, opts: { danger?: boolean; destacar?: boolean; disabled?: boolean } = {}) {
  return h(
    "div",
    { class: "item", style: { ...(opts.destacar ? { background: "var(--warn-bg)", borderRadius: "10px", padding: "9px 8px", boxShadow: "0 0 0 2px var(--warn)" } : {}), opacity: opts.disabled ? ".5" : "1" } },
    h("div", { class: "ava sm" }, icono),
    h("div", { class: "sp" }, h("div", { style: { fontWeight: "550" } }, titulo), h("div", { class: "xs muted" }, sub)),
    opts.disabled ? h("span", { class: "xs faint" }, "N/D") : toggle(valor, onChange, opts.danger),
  );
}

function draw() {
  const t = d.tarjetas[sel];
  if (!limites) limites = { diario: t.limiteDiario, cajero: t.limiteCajero };
  const sug = d.accionSugerida;

  const pinZona =
    verPin === "firma"
      ? otpPanel(
          h("div", { class: "small muted" }, `Ver PIN de ${t.alias}`),
          async () => {
            verPin = "si";
            draw();
            setTimeout(() => {
              verPin = "no";
              draw();
            }, 8000);
            return true;
          },
          () => ((verPin = "no"), draw()),
        ).panel
      : null;

  render(
    header("Mis tarjetas", `${d.tarjetas.length} tarjetas · cambios al instante`),
    h("div", { class: "tabs", style: { margin: "0 auto 12px" } }, ...d.tarjetas.map((x, i) => h("button", { class: `tab${i === sel ? " on" : ""}`, onclick: () => ((sel = i), (limites = null), (verPin = "no"), draw()) }, `${x.bloqueada ? "🔒 " : ""}${x.alias.split(" ")[0]} ${x.numero.slice(-4)}`))),
    cardVisual(t),
    h(
      "div",
      { class: "grid g3", style: { marginTop: "12px" } },
      h("div", { class: "card soft kpi" }, h("div", { class: "lbl" }, "Gastado este mes"), h("div", { class: "val", style: { fontSize: "17px" } }, eur(t.gastoMes))),
      t.limiteCredito
        ? h(
            "div",
            { class: "card soft kpi" },
            h("div", { class: "lbl" }, `Crédito disponible`),
            h("div", { class: "val", style: { fontSize: "17px" } }, eur(t.limiteCredito - (t.dispuesto ?? 0))),
            h("div", { class: "bar", style: { marginTop: "4px", height: "5px" } }, h("i", { style: { width: `${((t.dispuesto ?? 0) / t.limiteCredito) * 100}%`, background: "#d97706" } })),
          )
        : h("div", { class: "card soft kpi" }, h("div", { class: "lbl" }, "PIN"), verPin === "si" ? h("div", { class: "val num", style: { fontSize: "17px", letterSpacing: "4px" } }, "4 7 2 9") : h("a", { class: "link small", onclick: () => ((verPin = "firma"), draw()) }, t.tipo === "virtual" ? "Sin PIN (virtual)" : "👁 Ver PIN")),
    ),
    pinZona,
    h(
      "div",
      { class: "card", style: { marginTop: "12px", padding: "4px 12px" } },
      control("🔒", "Bloqueo temporal", t.bloqueada ? "Nadie puede usarla. Desbloquéala cuando quieras." : "Apágala si no la encuentras o ves algo raro", t.bloqueada, (v) => cambiar(t, { bloqueada: v }), { danger: true, destacar: sug === "bloquear" && !t.bloqueada }),
      control("🛒", "Compras online", "Pagos en webs y apps", t.comprasOnline, (v) => cambiar(t, { comprasOnline: v })),
      control("🌍", "Pagos en el extranjero", "Comercios y cajeros fuera de España", t.pagosExtranjero, (v) => cambiar(t, { pagosExtranjero: v }), { destacar: sug === "activar_extranjero" && !t.pagosExtranjero }),
      control("📶", "Contactless", "Pagos acercando la tarjeta", t.contactless, (v) => cambiar(t, { contactless: v }), { disabled: t.tipo === "virtual" }),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "12px", ...(sug === "cambiar_limites" ? { boxShadow: "0 0 0 2px var(--warn)" } : {}) } },
      h("div", { class: "b", style: { marginBottom: "6px" } }, "Límites"),
      slider("Compras al día", limites.diario, 100, 6000, 100, (v) => (limites!.diario = v)),
      t.tipo !== "virtual" ? slider("Retirada en cajeros al día", limites.cajero, 0, 1500, 50, (v) => (limites!.cajero = v)) : null,
      h(
        "button",
        {
          class: "btn primary sm",
          style: { marginTop: "6px" },
          onclick: () => cambiar(t, { limiteDiario: limites!.diario, ...(t.tipo !== "virtual" ? { limiteCajero: limites!.cajero } : {}) }),
        },
        "Guardar límites",
      ),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "12px" } },
      h("div", { class: "b" }, "Últimas operaciones"),
      h(
        "div",
        { class: "list" },
        ...t.ultimos.map((m) =>
          h(
            "div",
            { class: "item" },
            h("div", { class: "sp ellipsis" }, h("div", { class: "ellipsis" }, m.concepto), h("div", { class: "xs muted" }, `${fechaCorta(m.fecha)}${m.ubicacion ? ` · ${m.ubicacion}` : ""}`)),
            h("div", { class: "b num" }, eur(m.importe)),
            m.ubicacion && !["Madrid", "Online", "Alcobendas", "Pozuelo"].includes(m.ubicacion) ? h("button", { class: "btn sm", onclick: () => ask(`No reconozco el cargo "${m.concepto}" de ${eur(m.importe)} del ${m.fecha} en ${m.ubicacion}. Quiero abrir una consulta de fraude.`) }, "🚩") : null,
          ),
        ),
      ),
    ),
    h("div", { class: "chips", style: { marginTop: "12px" } }, h("span", { class: "chip", onclick: () => ask("He perdido la tarjeta, ¿qué hago?") }, "❓ La he perdido"), h("span", { class: "chip", onclick: () => ask("Quiero una tarjeta sin comisiones para viajar") }, "✈️ Tarjeta para viajar")),
    footer(),
  );
}

function slider(label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) {
  const out = h("span", { class: "b num" }, eur(value, false));
  return h(
    "label",
    { class: "f", style: { marginBottom: "8px" } },
    h("span", { class: "row" }, h("span", { class: "sp" }, label), out),
    h("input", {
      type: "range",
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value),
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        set(v);
        out.textContent = eur(v, false);
      },
    }),
  );
}

mount<Data>({
  onData: (x) => {
    d = x;
    sel = Math.max(0, d.tarjetas.findIndex((t) => t.id === d.destacada));
    draw();
  },
});
