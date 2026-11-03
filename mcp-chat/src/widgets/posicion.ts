import { ask, eur, fecha, footer, fullscreenButton, h, header, mesCorto, mount, pct, render, signed } from "./lib/runtime.ts";
import { line, sparkline } from "./lib/charts.ts";

interface Data {
  cliente: { nombre: string; segmento: string };
  fecha: string;
  patrimonioNeto: number;
  liquidez: number;
  invertido: number;
  inmuebles: number;
  deuda: number;
  cuentas: { id: string; alias: string; iban: string; saldo: number; tipo: string; tae?: number }[];
  tarjetas: { id: string; alias: string; numero: string; tipo: string; red: string; bloqueada: boolean; limiteCredito?: number; dispuesto?: number; color: string }[];
  prestamos: { id: string; nombre: string; importeInicial: number; capitalPendiente: number; cuota: number; proximaCuota: string; tin: number }[];
  inversiones: { id: string; nombre: string; valor: number; rentabilidad: number }[];
  mesActual: { ingresos: number; gastos: number };
  mesAnterior: { ingresos: number; gastos: number };
  evolucion: { mes: string; saldo: number }[];
  alertas: { nivel: string; titulo: string; texto: string; accion?: string }[];
}

const ICO: Record<string, string> = { peligro: "🚨", aviso: "⚠️", info: "🔔", exito: "🎉" };

function view(d: Data) {
  const ev = d.evolucion.map((e) => e.saldo);
  const varLiq = ev.length > 1 ? ev[ev.length - 1] - ev[0] : 0;
  const pctGasto = d.mesAnterior.gastos ? (d.mesActual.gastos / d.mesAnterior.gastos) * 100 : 0;

  render(
    header(`Hola, ${d.cliente.nombre}`, `${d.cliente.segmento} · ${fecha(d.fecha, { weekday: "long", day: "numeric", month: "long" })}`, fullscreenButton()),

    // Alertas tipo banner
    d.alertas.length
      ? h(
          "div",
          { class: "col", style: { gap: "6px", marginBottom: "12px" } },
          ...d.alertas.map((a) =>
            h(
              "div",
              { class: `banner ${a.nivel} fade` },
              h("span", { class: "ico" }, ICO[a.nivel] ?? "•"),
              h("div", { class: "sp" }, h("div", { class: "t" }, a.titulo), h("div", null, a.texto)),
              a.accion ? h("a", { onclick: () => ask(a.accion!) }, "Ver →") : null,
            ),
          ),
        )
      : null,

    // KPIs
    h(
      "div",
      { class: "grid g2" },
      h(
        "div",
        { class: "card kpi", style: { gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "16px" } },
        h(
          "div",
          { class: "sp" },
          h("div", { class: "lbl" }, "Patrimonio neto"),
          h("div", { class: "val big" }, eur(d.patrimonioNeto)),
          h("div", { class: "delta muted" }, `Liquidez ${signed(varLiq)} en 12 meses`),
        ),
        sparkline(ev, "var(--brand-2)", 150, 46),
      ),
    ),
    h(
      "div",
      { class: "grid g3", style: { marginTop: "10px" } },
      kpi("💶 Liquidez", eur(d.liquidez), `${d.cuentas.length} cuentas`),
      kpi("📈 Inversiones", eur(d.invertido), `${d.inversiones.length} productos`),
      kpi("🏠 Vivienda (estimada)", eur(d.inmuebles, false), "Valor de tasación"),
      kpi("🏦 Deuda", eur(d.deuda), "Hipoteca y crédito"),
    ),

    // Mes en curso
    h(
      "div",
      { class: "card", style: { marginTop: "10px" } },
      h("div", { class: "row" }, h("div", { class: "b" }, "Este mes"), h("div", { class: "sp" }), h("a", { class: "link small", onclick: () => ask("Analiza mis gastos de este mes comparados con el mes pasado") }, "Analizar →")),
      h(
        "div",
        { class: "grid g2", style: { marginTop: "8px" } },
        h("div", null, h("div", { class: "small muted" }, "Ingresos"), h("div", { class: "b num pos", style: { fontSize: "18px" } }, eur(d.mesActual.ingresos)), h("div", { class: "xs faint" }, `Mes anterior ${eur(d.mesAnterior.ingresos)}`)),
        h(
          "div",
          null,
          h("div", { class: "small muted" }, "Gastos"),
          h("div", { class: "b num", style: { fontSize: "18px" } }, eur(d.mesActual.gastos)),
          h("div", { class: "bar", style: { marginTop: "4px" } }, h("i", { style: { width: `${Math.min(100, pctGasto)}%`, background: pctGasto > 90 ? "var(--bad)" : "var(--brand-2)" } })),
          h("div", { class: "xs faint" }, `${pct(pctGasto, 0)} de lo gastado el mes pasado (${eur(d.mesAnterior.gastos)})`),
        ),
      ),
    ),

    // Cuentas
    section("Cuentas"),
    h(
      "div",
      { class: "grid g2" },
      ...d.cuentas.map((c) =>
        h(
          "div",
          { class: "card item click", style: { borderBottom: "1px solid var(--line)" }, onclick: () => ask(`Enséñame los últimos movimientos de mi ${c.alias}`) },
          h("div", { class: "ava" }, c.tipo === "ahorro" ? "🐷" : "🏦"),
          h("div", { class: "sp ellipsis" }, h("div", { class: "b" }, c.alias), h("div", { class: "xs faint num" }, `${c.iban.slice(0, 4)} •••• ${c.iban.slice(-4)}`), c.tae ? h("span", { class: "badge ok" }, `${c.tae}% TAE`) : null),
          h("div", { class: "b num" }, eur(c.saldo)),
        ),
      ),
    ),

    // Tarjetas
    section("Tarjetas", h("a", { class: "link small", onclick: () => ask("Quiero gestionar mis tarjetas") }, "Gestionar →")),
    h(
      "div",
      { class: "row scroll-x" },
      ...d.tarjetas.map((t) =>
        h(
          "div",
          { style: { background: t.color, color: "white", borderRadius: "12px", padding: "10px 12px", minWidth: "170px", flex: "1", position: "relative", opacity: t.bloqueada ? "0.55" : "1" } },
          h("div", { class: "row small" }, h("span", { class: "b" }, t.alias), h("span", { class: "sp" }), h("span", { class: "xs" }, t.red)),
          h("div", { class: "num", style: { marginTop: "14px", letterSpacing: "1px" } }, `•••• ${t.numero.slice(-4)}`),
          t.limiteCredito ? h("div", { class: "xs", style: { opacity: ".85" } }, `Dispuesto ${eur(t.dispuesto ?? 0)} de ${eur(t.limiteCredito, false)}`) : h("div", { class: "xs", style: { opacity: ".85" } }, t.tipo === "virtual" ? "Virtual · solo online" : "Débito"),
          t.bloqueada ? h("span", { class: "badge bad", style: { position: "absolute", right: "8px", bottom: "8px" } }, "🔒 Bloqueada") : null,
        ),
      ),
    ),

    // Préstamos e inversiones
    h(
      "div",
      { class: "grid g2", style: { marginTop: "10px" } },
      ...d.prestamos.map((p) => {
        const amort = ((p.importeInicial - p.capitalPendiente) / p.importeInicial) * 100;
        return h(
          "div",
          { class: "card" },
          h("div", { class: "row" }, h("span", null, "🏠"), h("div", { class: "b sp ellipsis" }, p.nombre)),
          h("div", { class: "small muted", style: { margin: "4px 0" } }, `Pendiente ${eur(p.capitalPendiente)} · cuota ${eur(p.cuota)} el ${fecha(p.proximaCuota, { day: "numeric", month: "short" })}`),
          h("div", { class: "bar" }, h("i", { style: { width: `${amort}%`, background: "#6366f1" } })),
          h("div", { class: "xs faint", style: { marginTop: "3px" } }, `${pct(amort, 0)} amortizado · TIN ${p.tin}%`),
        );
      }),
      h(
        "div",
        { class: "card click", style: { cursor: "pointer" }, onclick: () => ask("¿Cómo van mis inversiones?") },
        h("div", { class: "row" }, h("span", null, "📈"), h("div", { class: "b sp" }, "Inversiones")),
        ...d.inversiones.map((i) => h("div", { class: "row small", style: { marginTop: "6px" } }, h("span", { class: "sp ellipsis muted" }, i.nombre), h("span", { class: "num b" }, eur(i.valor)), h("span", { class: `badge ${i.rentabilidad >= 0 ? "ok" : "bad"}` }, `${i.rentabilidad >= 0 ? "+" : ""}${pct(i.rentabilidad)}`))),
      ),
    ),

    // Evolución
    section("Evolución de tu liquidez (12 meses)"),
    h("div", { class: "card" }, line(d.evolucion.map((e) => mesCorto(e.mes)), [{ name: "Saldo", color: "#10a37f", values: ev }], { area: true, fmt: (n) => eur(n, false), height: 170 })),

    // Acciones rápidas
    h(
      "div",
      { class: "chips", style: { marginTop: "12px" } },
      ...[
        ["💸 Enviar Bizum", "Quiero enviar un Bizum"],
        ["🔄 Transferencia", "Quiero hacer una transferencia"],
        ["📊 ¿En qué gasto?", "¿En qué he gastado más en los últimos 6 meses?"],
        ["🧾 Recibos", "Muéstrame mis recibos y pagos pendientes"],
        ["🎯 Objetivos", "Ver mis objetivos de ahorro"],
      ].map(([l, q]) => h("span", { class: "chip", onclick: () => ask(q) }, l)),
    ),
    footer(),
  );
}

const kpi = (lbl: string, val: string, sub: string) => h("div", { class: "card kpi" }, h("div", { class: "lbl" }, lbl), h("div", { class: "val", style: { fontSize: "19px" } }, val), h("div", { class: "xs faint" }, sub));
const section = (t: string, ...extra: (Node | null)[]) => h("div", { class: "row", style: { margin: "16px 0 8px" } }, h("div", { class: "b" }, t), h("div", { class: "sp" }), ...extra);

mount<Data>({ onData: view });
