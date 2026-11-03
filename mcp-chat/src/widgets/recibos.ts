import { ask, call, cat, diasHasta, eur, fecha, fechaCorta, footer, h, header, mount, otpPanel, render, successPanel, tabs, tellModel, toast } from "./lib/runtime.ts";
import { sparkline } from "./lib/charts.ts";

interface Recibo {
  id: string;
  emisor: string;
  categoria: string;
  periodicidad: string;
  ultimoImporte: number;
  importeMedio: number;
  proximoCargo: string;
  historico: { fecha: string; importe: number; movimientoId: string; estado: string }[];
  alerta?: string;
}
interface Pago {
  id: string;
  concepto: string;
  emisor: string;
  importe: number;
  vencimiento: string;
  referencia: string;
  descuento?: { importe: number; hasta: string; motivo: string };
  estado: string;
}
interface Data {
  recibos: Recibo[];
  suscripciones: Recibo[];
  gastoMensualRecibos: number;
  gastoMensualSuscripciones: number;
  proximos: { id: string; emisor: string; fecha: string; importeEstimado: number }[];
  pagosPendientes: Pago[];
}

let d: Data;
let vista: "pagos" | "recibos" | "suscripciones" = "pagos";
let abierto: string | null = null;
let pagando: Pago | null = null;
let hecho: string | null = null;

const importePago = (p: Pago) => (p.descuento && p.descuento.hasta >= new Date().toISOString().slice(0, 10) ? p.descuento.importe : p.importe);

function draw() {
  if (hecho)
    return render(header("Pagos", "Operación completada"), successPanel("Pago realizado", hecho, h("button", { class: "btn", onclick: () => ((hecho = null), draw()) }, "Volver")), footer());

  if (pagando) {
    const p = pagando;
    const { panel, setError } = otpPanel(
      h(
        "div",
        { class: "card soft col", style: { gap: "4px" } },
        h("div", { class: "b" }, p.concepto),
        h("div", { class: "small muted" }, `${p.emisor} · Ref. ${p.referencia}`),
        h("div", { class: "row" }, h("span", { class: "sp" }, "Importe a pagar"), h("span", { class: "b num", style: { fontSize: "20px" } }, eur(importePago(p)))),
        importePago(p) < p.importe ? h("span", { class: "badge ok" }, `Ahorras ${eur(p.importe - importePago(p))} · ${p.descuento!.motivo}`) : null,
      ),
      async (otp) => {
        const r = await call("pagar_pendiente", { pagoId: p.id, otp }, { silent: true });
        if (!r.ok) {
          setError(r.text);
          return false;
        }
        p.estado = "pagado";
        pagando = null;
        hecho = r.text;
        tellModel(`La usuaria pagó con firma: ${r.text}`);
        draw();
        return true;
      },
      () => ((pagando = null), draw()),
    );
    return render(header("Pagar", "Firma la operación"), panel, footer());
  }

  const pendientes = d.pagosPendientes.filter((p) => p.estado === "pendiente");
  render(
    header("Recibos y pagos", `${eur(d.gastoMensualRecibos)}/mes en recibos · ${eur(d.gastoMensualSuscripciones)} en suscripciones`),
    tabs(
      [
        ["pagos", `Pagos pendientes${pendientes.length ? ` (${pendientes.length})` : ""}`],
        ["recibos", "Recibos"],
        ["suscripciones", "Suscripciones"],
      ],
      vista,
      (v) => ((vista = v), draw()),
    ),
    h("div", { style: { marginTop: "12px" } }, vista === "pagos" ? vistaPagos() : vista === "recibos" ? vistaRecibos(d.recibos) : vistaSuscripciones()),
    footer(),
  );
}

function vistaPagos() {
  return h(
    "div",
    { class: "col" },
    ...d.pagosPendientes.map((p) => {
      const dias = diasHasta(p.vencimiento);
      const desc = p.descuento && diasHasta(p.descuento.hasta) >= 0;
      return h(
        "div",
        { class: "card", style: p.estado === "pagado" ? { opacity: ".6" } : {} },
        h(
          "div",
          { class: "row" },
          h("div", { class: "ava" }, p.id.includes("multa") ? "🚦" : p.id.includes("ivtm") ? "🏛️" : "🦷"),
          h("div", { class: "sp" }, h("div", { class: "b" }, p.concepto), h("div", { class: "xs muted" }, `${p.emisor} · Ref. ${p.referencia}`)),
          h("div", { class: "right" }, desc ? h("div", { class: "xs faint", style: { textDecoration: "line-through" } }, eur(p.importe)) : null, h("div", { class: "b num" }, eur(importePago(p)))),
        ),
        h(
          "div",
          { class: "row wrap", style: { marginTop: "8px", gap: "6px" } },
          p.estado === "pagado" ? h("span", { class: "badge ok" }, "✓ Pagado") : h("span", { class: `badge ${dias <= 7 ? "bad" : "warn"}` }, `Vence ${dias <= 0 ? "hoy" : `en ${dias} días`} · ${fechaCorta(p.vencimiento)}`),
          desc && p.estado !== "pagado" ? h("span", { class: "badge ok" }, `💡 ${p.descuento!.motivo} hasta el ${fechaCorta(p.descuento!.hasta)}`) : null,
          h("span", { class: "sp" }),
          p.estado !== "pagado" ? h("button", { class: "btn primary sm", onclick: () => ((pagando = p), draw()) }, `Pagar ${eur(importePago(p))}`) : null,
        ),
      );
    }),
    h(
      "div",
      { class: "card soft" },
      h("div", { class: "b small", style: { marginBottom: "6px" } }, "📅 Próximos cargos (30 días)"),
      ...d.proximos.map((p) => h("div", { class: "row small", style: { padding: "3px 0" } }, h("span", { class: "muted", style: { width: "64px" } }, fechaCorta(p.fecha)), h("span", { class: "sp ellipsis" }, p.emisor), h("span", { class: "num" }, `~${eur(p.importeEstimado)}`))),
    ),
  );
}

function vistaRecibos(lista: Recibo[]) {
  return h(
    "div",
    { class: "list" },
    ...lista.flatMap((r) => {
      const cancelado = r.proximoCargo === "Cancelado";
      const ultimo = r.historico[r.historico.length - 1];
      const devolvible = ultimo && ultimo.estado === "completado" && diasHasta(ultimo.fecha) >= -56;
      return [
        h(
          "div",
          { class: "item click", onclick: () => ((abierto = abierto === r.id ? null : r.id), draw()), style: cancelado ? { opacity: ".55" } : {} },
          h("div", { class: "ava", style: { background: `color-mix(in srgb, ${cat(r.categoria).c} 16%, transparent)` } }, cat(r.categoria).e),
          h(
            "div",
            { class: "sp ellipsis" },
            h("div", { class: "ellipsis", style: { fontWeight: "550" } }, r.emisor),
            h("div", { class: "xs muted" }, cancelado ? "Cancelado" : `${r.periodicidad} · próximo ${fechaCorta(r.proximoCargo)}`),
            r.alerta && !cancelado ? h("span", { class: "badge warn", style: { marginTop: "3px" } }, `🔔 ${r.alerta}`) : null,
          ),
          r.historico.length > 2 ? sparkline(r.historico.map((x) => x.importe), r.alerta ? "#f59e0b" : "var(--fg3)", 70, 26) : null,
          h("div", { class: "right" }, h("div", { class: "b num" }, eur(r.ultimoImporte)), h("div", { class: "xs faint" }, `media ${eur(r.importeMedio)}`)),
        ),
        abierto === r.id
          ? h(
              "div",
              { class: "card soft fade", style: { margin: "0 0 8px 44px" } },
              h("div", { class: "small b", style: { marginBottom: "4px" } }, "Últimos cargos"),
              ...r.historico
                .slice(-6)
                .reverse()
                .map((x) => h("div", { class: "row small" }, h("span", { class: "muted sp" }, fecha(x.fecha)), x.estado === "devuelto" ? h("span", { class: "badge info" }, "Devuelto") : null, h("span", { class: "num" }, eur(x.importe)))),
              h(
                "div",
                { class: "row wrap", style: { gap: "6px", marginTop: "8px" } },
                devolvible
                  ? h(
                      "button",
                      {
                        class: "btn sm",
                        onclick: async () => {
                          const res = await call("devolver_recibo", { movimientoId: ultimo.movimientoId, motivo: "Desde gestión de recibos" });
                          if (res.ok) {
                            ultimo.estado = "devuelto";
                            toast(res.text);
                            tellModel(`La usuaria devolvió el último recibo de ${r.emisor}: ${res.text}`);
                            draw();
                          }
                        },
                      },
                      `↩️ Devolver último (${eur(ultimo.importe)})`,
                    )
                  : null,
                h("button", { class: "btn sm", onclick: () => ask(`¿Por qué ha variado mi recibo de ${r.emisor}? Compara los últimos meses.`) }, "💬 Preguntar"),
              ),
            )
          : null,
      ];
    }),
  );
}

function vistaSuscripciones() {
  const subs = d.suscripciones;
  const anual = subs.reduce((s, r) => s + r.ultimoImporte * 12, 0);
  return h(
    "div",
    { class: "col" },
    h(
      "div",
      { class: "card soft row" },
      h("div", { class: "sp kpi" }, h("div", { class: "lbl" }, "Gastas en suscripciones"), h("div", { class: "val" }, `${eur(d.gastoMensualSuscripciones)}/mes`), h("div", { class: "xs muted" }, `${eur(anual, false)} al año`)),
      h("button", { class: "btn sm", onclick: () => ask("¿Qué suscripciones podría cancelar para ahorrar? Dame recomendaciones.") }, "✨ ¿Cuáles cancelo?"),
    ),
    vistaRecibos(subs),
  );
}

mount<Data>({
  onData: (x) => {
    d = x;
    draw();
  },
});
