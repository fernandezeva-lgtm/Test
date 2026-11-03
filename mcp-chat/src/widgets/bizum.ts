import { call, eur, footer, h, header, mount, otpPanel, render, successPanel, tabs, tellModel, toast } from "./lib/runtime.ts";

interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
  avatar: string;
  frecuente: boolean;
}
interface Data {
  cuentas: { id: string; alias: string; saldo: number }[];
  contactos: Contacto[];
  limites: { bizumMin: number; bizumMax: number };
  propuesta: { modo?: "enviar" | "solicitar"; contactoId?: string | null; telefono?: string | null; importe?: number; concepto?: string };
}

let d: Data;
const st = { modo: "enviar" as "enviar" | "solicitar", contactoId: null as string | null, telefono: "", importe: "", concepto: "", paso: "form" as "form" | "firma" | "hecho", resultado: "" };

const contacto = () => d.contactos.find((c) => c.id === st.contactoId);
const telefono = () => contacto()?.telefono ?? st.telefono;
const importe = () => Number(st.importe.replace(",", "."));

function errores() {
  const e: string[] = [];
  if (!telefono() || telefono().replace(/\D/g, "").length < 9) e.push("Elige un contacto o escribe un móvil");
  const n = importe();
  if (!n || n < d.limites.bizumMin) e.push(`Mínimo ${eur(d.limites.bizumMin)}`);
  if (n > d.limites.bizumMax) e.push(`Máximo ${eur(d.limites.bizumMax, false)} por operación`);
  if (st.modo === "enviar" && n > d.cuentas[0].saldo) e.push("Saldo insuficiente");
  return e;
}

async function ejecutar(otp?: string) {
  const r = await call<{ mensaje: string; saldoRestante?: number }>("confirmar_bizum", { telefono: telefono(), importe: importe(), concepto: st.concepto || undefined, modo: st.modo, otp }, { silent: true });
  if (!r.ok) return r.text;
  st.paso = "hecho";
  st.resultado = r.text;
  if (r.data.saldoRestante != null) d.cuentas[0].saldo = r.data.saldoRestante;
  tellModel(`Bizum ${st.modo === "enviar" ? "ENVIADO" : "SOLICITADO"} y confirmado por la usuaria con firma: ${r.text}`);
  draw();
  return null;
}

function draw() {
  if (st.paso === "hecho")
    return render(
      header("Bizum", "Operación completada"),
      successPanel(
        st.modo === "enviar" ? "¡Bizum enviado!" : "¡Solicitud enviada!",
        st.resultado,
        h("button", { class: "btn", onclick: () => Object.assign(st, { paso: "form", importe: "", concepto: "" }) && draw() }, "Hacer otro Bizum"),
      ),
      st.modo === "enviar" ? h("div", { class: "small muted", style: { textAlign: "center" } }, `Saldo disponible: ${eur(d.cuentas[0].saldo)}`) : null,
      footer(),
    );

  const c = contacto();
  const resumen = h(
    "div",
    { class: "card soft row" },
    h("div", { class: "ava" }, c?.avatar ?? "📱"),
    h("div", { class: "sp" }, h("div", { class: "b" }, c?.nombre ?? telefono()), h("div", { class: "xs muted" }, `${telefono()}${st.concepto ? ` · ${st.concepto}` : ""}`)),
    h("div", { class: "b num", style: { fontSize: "20px" } }, eur(importe())),
  );

  if (st.paso === "firma") {
    const { panel, setError } = otpPanel(
      resumen,
      async (otp) => {
        const err = await ejecutar(otp);
        if (err) setError(err);
        return !err;
      },
      () => ((st.paso = "form"), draw()),
    );
    return render(header("Confirma tu Bizum", "Paso 2 de 2 · Firma"), panel, footer());
  }

  const errs = errores();
  const amount = h("input", {
    class: "inp big num",
    inputmode: "decimal",
    placeholder: "0,00",
    value: st.importe,
    oninput: (e: Event) => {
      st.importe = (e.target as HTMLInputElement).value.replace(/[^\d,.]/g, "");
      refreshBtn();
    },
  });
  const btn = h("button", { class: "btn primary block", style: { marginTop: "12px" } });
  const errEl = h("div", { class: "hint err", style: { marginTop: "6px", minHeight: "14px" } });
  function refreshBtn() {
    const e = errores();
    btn.disabled = e.length > 0;
    btn.textContent = st.modo === "enviar" ? `Enviar ${importe() ? eur(importe()) : ""}` : `Solicitar ${importe() ? eur(importe()) : ""}`;
    errEl.textContent = st.importe || st.contactoId || st.telefono ? e.join(" · ") : "";
  }
  btn.onclick = async () => {
    if (errores().length) return;
    if (st.modo === "solicitar") {
      btn.disabled = true;
      const err = await ejecutar();
      if (err) toast(err, true);
      return;
    }
    st.paso = "firma";
    draw();
  };
  refreshBtn();

  const ordenados = [...d.contactos].sort((a, b) => Number(b.frecuente) - Number(a.frecuente));
  render(
    header("Bizum", `Disponible ${eur(d.cuentas[0].saldo)} · ${d.cuentas[0].alias}`),
    tabs(
      [
        ["enviar", "Enviar"],
        ["solicitar", "Solicitar"],
      ],
      st.modo,
      (v) => ((st.modo = v), draw()),
    ),
    h("div", { class: "small b", style: { margin: "14px 0 6px" } }, st.modo === "enviar" ? "¿A quién?" : "¿A quién se lo pides?"),
    h(
      "div",
      { class: "pill-sel" },
      ...ordenados.map((ct) =>
        h(
          "div",
          { class: `contact${ct.id === st.contactoId ? " on" : ""}`, onclick: () => ((st.contactoId = ct.id === st.contactoId ? null : ct.id), (st.telefono = ""), draw()) },
          h("div", { class: "ava" }, ct.avatar),
          h("div", { class: "ellipsis", style: { maxWidth: "70px" } }, ct.nombre.split(" ")[0]),
        ),
      ),
    ),
    !st.contactoId
      ? h("input", {
          class: "inp",
          style: { marginTop: "8px" },
          placeholder: "…o escribe un móvil: +34 6XX XXX XXX",
          inputmode: "tel",
          value: st.telefono,
          oninput: (e: Event) => {
            st.telefono = (e.target as HTMLInputElement).value;
            refreshBtn();
          },
        })
      : null,
    h("div", { class: "small b", style: { margin: "14px 0 6px" } }, "Importe"),
    h("div", { class: "row" }, amount, h("span", { class: "b", style: { fontSize: "22px" } }, "€")),
    h("div", { class: "chips", style: { marginTop: "8px" } }, ...[5, 10, 20, 50, 100].map((n) => h("span", { class: "chip", onclick: () => ((st.importe = String(n)), draw()) }, `${n} €`))),
    h("div", { class: "small b", style: { margin: "14px 0 6px" } }, "Concepto"),
    h("input", {
      class: "inp",
      maxlength: "35",
      placeholder: "Cena, regalo, entradas…",
      value: st.concepto,
      oninput: (e: Event) => (st.concepto = (e.target as HTMLInputElement).value),
    }),
    h("div", { class: "chips", style: { marginTop: "6px" } }, ...["🍕 Cena", "🎁 Regalo", "🎟️ Entradas", "🚕 Taxi", "🎾 Pádel"].map((t) => h("span", { class: "chip", onclick: () => ((st.concepto = t), draw()) }, t))),
    errEl,
    btn,
    h("div", { class: "xs faint", style: { textAlign: "center", marginTop: "6px" } }, `Entre ${eur(d.limites.bizumMin)} y ${eur(d.limites.bizumMax, false)} · Llega al instante`),
    footer(),
  );
  if (!errs.length) btn.disabled = false;
}

mount<Data>({
  onData: (x) => {
    d = x;
    const p = x.propuesta ?? {};
    st.modo = p.modo ?? "enviar";
    st.contactoId = p.contactoId ?? null;
    st.telefono = p.contactoId ? "" : (p.telefono ?? "");
    st.importe = p.importe ? String(p.importe).replace(".", ",") : "";
    st.concepto = p.concepto ?? "";
    draw();
  },
});
