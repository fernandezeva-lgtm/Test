import { call, eur, fecha, footer, h, header, mount, otpPanel, render, successPanel, tabs, tellModel, toggle } from "./lib/runtime.ts";

interface Data {
  cuentas: { id: string; alias: string; iban: string; saldo: number }[];
  beneficiarios: { id: string; nombre: string; iban: string; banco: string; alias?: string }[];
  limites: { transferenciaMax: number };
  propuesta: { beneficiarioId?: string | null; iban?: string | null; nombre?: string | null; importe?: number; concepto?: string; cuentaOrigen?: string; fecha?: string };
}

let d: Data;
const st = {
  origen: "cta-nomina",
  destino: "guardado" as "guardado" | "nuevo",
  sel: null as string | null, // id beneficiario o "cta:<id>"
  iban: "",
  nombre: "",
  guardar: true,
  importe: "",
  concepto: "",
  inmediata: true,
  programar: false,
  fecha: "",
  paso: "form" as "form" | "firma" | "hecho",
  resultado: "",
};

function ibanValido(iban: string) {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s) || (s.startsWith("ES") && s.length !== 24)) return false;
  const num = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let m = 0;
  for (const ch of num) m = (m * 10 + Number(ch)) % 97;
  return m === 1;
}
const fmtIban = (s: string) => s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
const origen = () => d.cuentas.find((c) => c.id === st.origen)!;
const importe = () => Number(st.importe.replace(/\./g, "").replace(",", "."));

function destino(): { nombre: string; iban: string } | null {
  if (st.destino === "nuevo") return ibanValido(st.iban) && st.nombre.trim() ? { nombre: st.nombre.trim(), iban: fmtIban(st.iban) } : null;
  if (!st.sel) return null;
  if (st.sel.startsWith("cta:")) {
    const c = d.cuentas.find((x) => `cta:${x.id}` === st.sel)!;
    return { nombre: c.alias, iban: c.iban };
  }
  const b = d.beneficiarios.find((x) => x.id === st.sel);
  return b ? { nombre: b.nombre, iban: b.iban } : null;
}

function errores() {
  const e: string[] = [];
  if (!destino()) e.push(st.destino === "nuevo" ? (st.iban && !ibanValido(st.iban) ? "IBAN no válido" : "Completa IBAN y titular") : "Elige un destinatario");
  if (st.sel === `cta:${st.origen}`) e.push("Origen y destino son la misma cuenta");
  const n = importe();
  if (!n || n <= 0) e.push("Indica un importe");
  else if (n > d.limites.transferenciaMax) e.push(`Máximo ${eur(d.limites.transferenciaMax, false)}`);
  else if (!st.programar && n > origen().saldo) e.push("Saldo insuficiente");
  if (st.programar && !st.fecha) e.push("Elige la fecha");
  return e;
}

async function ejecutar(otp: string) {
  const dest = destino()!;
  const r = await call<{ mensaje: string }>(
    "confirmar_transferencia",
    {
      cuentaOrigen: st.origen,
      iban: dest.iban,
      beneficiario: dest.nombre,
      importe: importe(),
      concepto: st.concepto || undefined,
      inmediata: st.inmediata && !st.programar,
      fecha: st.programar ? st.fecha : undefined,
      guardarBeneficiario: st.destino === "nuevo" && st.guardar,
      otp,
    },
    { silent: true },
  );
  if (!r.ok) return r.text;
  st.paso = "hecho";
  st.resultado = r.text;
  tellModel(`Transferencia confirmada por la usuaria con firma: ${r.text}`);
  draw();
  return null;
}

function draw() {
  if (st.paso === "hecho")
    return render(header("Transferencia", "Operación completada"), successPanel(st.programar ? "Transferencia programada" : "¡Transferencia enviada!", st.resultado, h("button", { class: "btn", onclick: () => ((st.paso = "form"), (st.importe = ""), draw()) }, "Hacer otra")), footer());

  const dest = destino();
  if (st.paso === "firma") {
    const resumen = h(
      "div",
      { class: "card soft col", style: { gap: "6px" } },
      h("div", { class: "row small" }, h("span", { class: "muted sp" }, "Desde"), h("span", null, origen().alias)),
      h("div", { class: "row small" }, h("span", { class: "muted sp" }, "Para"), h("span", { class: "b" }, dest!.nombre)),
      h("div", { class: "row small" }, h("span", { class: "muted sp" }, "IBAN"), h("span", { class: "num" }, dest!.iban)),
      st.concepto ? h("div", { class: "row small" }, h("span", { class: "muted sp" }, "Concepto"), h("span", null, st.concepto)) : null,
      h("div", { class: "row small" }, h("span", { class: "muted sp" }, "Cuándo"), h("span", null, st.programar ? fecha(st.fecha) : st.inmediata ? "Ahora · inmediata (gratis)" : "Ordinaria · próximo día hábil")),
      h("div", { class: "sep" }),
      h("div", { class: "row" }, h("span", { class: "b sp" }, "Importe"), h("span", { class: "b num", style: { fontSize: "20px" } }, eur(importe()))),
    );
    const { panel, setError } = otpPanel(
      resumen,
      async (otp) => {
        const err = await ejecutar(otp);
        if (err) setError(err);
        return !err;
      },
      () => ((st.paso = "form"), draw()),
    );
    return render(header("Confirma la transferencia", "Paso 2 de 2 · Firma"), panel, footer());
  }

  const btn = h("button", { class: "btn primary block", style: { marginTop: "14px" } }, "Continuar");
  const errEl = h("div", { class: "hint err", style: { marginTop: "6px", minHeight: "14px" } });
  const refresh = () => {
    const e = errores();
    btn.disabled = e.length > 0;
    errEl.textContent = st.importe || st.sel || st.iban ? e.join(" · ") : "";
  };
  btn.onclick = () => {
    if (!errores().length) {
      st.paso = "firma";
      draw();
    }
  };
  const ibanInp = h("input", {
    class: `inp num${st.iban && !ibanValido(st.iban) ? " err" : ""}`,
    placeholder: "ES00 0000 0000 0000 0000 0000",
    value: st.iban,
    oninput: (e: Event) => {
      const el = e.target as HTMLInputElement;
      st.iban = el.value.toUpperCase();
      el.classList.toggle("err", st.iban.replace(/\s/g, "").length >= 24 && !ibanValido(st.iban));
      ibanOk.textContent = ibanValido(st.iban) ? "✓ IBAN válido" : "";
      refresh();
    },
  });
  const ibanOk = h("span", { class: "xs pos" }, ibanValido(st.iban) ? "✓ IBAN válido" : "");

  render(
    header("Nueva transferencia", "Inmediatas gratis · hasta 15.000 €"),
    h("label", { class: "f" }, "Desde", h("select", { class: "inp", onchange: (e: Event) => ((st.origen = (e.target as HTMLSelectElement).value), draw()) }, ...d.cuentas.map((c) => h("option", { value: c.id, selected: c.id === st.origen }, `${c.alias} · ${eur(c.saldo)}`)))),
    h("div", { class: "row", style: { margin: "14px 0 8px" } }, h("div", { class: "small b sp" }, "Para"), tabs([["guardado", "Guardados"], ["nuevo", "Nuevo IBAN"]], st.destino, (v) => ((st.destino = v), draw()))),
    st.destino === "guardado"
      ? h(
          "div",
          { class: "list card", style: { padding: "4px 8px" } },
          ...d.cuentas
            .filter((c) => c.id !== st.origen)
            .map((c) => fila(`cta:${c.id}`, "🐷", `Mi ${c.alias}`, `Traspaso entre cuentas · ${c.iban.slice(-9)}`)),
          ...d.beneficiarios.map((b) => fila(b.id, b.nombre.slice(0, 1), b.alias ? `${b.alias} · ${b.nombre}` : b.nombre, `${b.banco} · ${b.iban.slice(0, 4)} …${b.iban.slice(-4)}`)),
        )
      : h(
          "div",
          { class: "col card" },
          h("label", { class: "f" }, h("span", { class: "row" }, "IBAN", h("span", { class: "sp" }), ibanOk), ibanInp),
          h("label", { class: "f" }, "Titular", h("input", { class: "inp", placeholder: "Nombre y apellidos o razón social", value: st.nombre, oninput: (e: Event) => ((st.nombre = (e.target as HTMLInputElement).value), refresh()) })),
          h("label", { class: "row small" }, toggle(st.guardar, (v) => (st.guardar = v)), "Guardar como beneficiario"),
        ),
    h(
      "div",
      { class: "grid g2", style: { marginTop: "12px" } },
      h("label", { class: "f" }, "Importe (€)", h("input", { class: "inp num", inputmode: "decimal", placeholder: "0,00", value: st.importe, style: { fontSize: "18px", fontWeight: "700" }, oninput: (e: Event) => ((st.importe = (e.target as HTMLInputElement).value.replace(/[^\d,.]/g, "")), refresh()) })),
      h("label", { class: "f" }, "Concepto", h("input", { class: "inp", maxlength: "60", placeholder: "Opcional", value: st.concepto, oninput: (e: Event) => (st.concepto = (e.target as HTMLInputElement).value) })),
    ),
    h(
      "div",
      { class: "card soft col", style: { marginTop: "12px", gap: "8px" } },
      h("label", { class: "row small" }, toggle(st.inmediata && !st.programar, (v) => ((st.inmediata = v), v && (st.programar = false), draw())), h("span", { class: "sp" }, "⚡ Transferencia inmediata"), h("span", { class: "badge ok" }, "Gratis")),
      h("label", { class: "row small" }, toggle(st.programar, (v) => ((st.programar = v), draw())), h("span", { class: "sp" }, "🗓️ Programar para otra fecha")),
      st.programar ? h("input", { class: "inp", type: "date", value: st.fecha, min: new Date(Date.now() + 86400000).toISOString().slice(0, 10), onchange: (e: Event) => ((st.fecha = (e.target as HTMLInputElement).value), refresh()) }) : null,
    ),
    errEl,
    btn,
    footer(),
  );
  refresh();
}

function fila(id: string, ava: string, titulo: string, sub: string) {
  return h(
    "div",
    { class: "item click", style: st.sel === id ? { background: "var(--brand-soft)" } : {}, onclick: () => ((st.sel = id), draw()) },
    h("div", { class: "ava sm" }, ava),
    h("div", { class: "sp ellipsis" }, h("div", { class: "ellipsis", style: { fontWeight: "550" } }, titulo), h("div", { class: "xs muted" }, sub)),
    st.sel === id ? h("span", { class: "pos b" }, "✓") : null,
  );
}

mount<Data>({
  onData: (x) => {
    d = x;
    const p = x.propuesta ?? {};
    if (p.cuentaOrigen) st.origen = p.cuentaOrigen;
    const propia = p.iban ? d.cuentas.find((c) => c.iban === p.iban) : undefined;
    if (p.beneficiarioId) st.sel = p.beneficiarioId;
    else if (propia) st.sel = `cta:${propia.id}`;
    else if (p.iban) Object.assign(st, { destino: "nuevo", iban: p.iban, nombre: p.nombre ?? "" });
    if (propia && propia.id === st.origen) st.origen = d.cuentas.find((c) => c.id !== propia.id)!.id;
    if (p.importe) st.importe = String(p.importe).replace(".", ",");
    if (p.concepto) st.concepto = p.concepto;
    if (p.fecha) Object.assign(st, { programar: true, fecha: p.fecha });
    draw();
  },
});
