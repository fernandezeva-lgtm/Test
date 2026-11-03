import { ask, call, downloadText, eur, fecha, footer, h, header, mount, otpPanel, render, tellModel, toast, toggle } from "./lib/runtime.ts";

interface Cliente {
  nombre: string;
  apellidos: string;
  nombreCompleto: string;
  dni: string;
  fechaNacimiento: string;
  email: string;
  telefono: string;
  direccion: { calle: string; cp: string; ciudad: string; provincia: string };
  profesion: string;
  segmento: string;
  clienteDesde: string;
  avatar: string;
  preferencias: { notificacionesPush: boolean; extractosPapel: boolean; alertasSaldo: number };
  gestor: { nombre: string; email: string; telefono: string; oficina: string };
  productosContratados: { tipo: string; nombre: string; detalle: string; valor: number | null }[];
}
interface Data {
  cliente: Cliente;
  operaciones: { id: string; fecha: string; tipo: string; descripcion: string; importe?: number; estado: string; referencia: string }[];
  consultas: { id: string; asunto: string; estado: string; fecha: string }[];
}

let d: Data;
let editando = false;
let firma: Record<string, unknown> | null = null;
const borrador: Record<string, string> = {};

function draw() {
  const c = d.cliente;
  if (firma) {
    const cambios = firma;
    const { panel, setError } = otpPanel(
      h("div", { class: "card soft small" }, h("div", { class: "b", style: { marginBottom: "4px" } }, "Vas a cambiar:"), ...Object.entries(cambios).map(([k, v]) => h("div", null, `• ${k}: `, h("b", null, String(v))))),
      async (otp) => {
        const r = await call<{ cliente: Cliente; mensaje: string }>("actualizar_perfil", { ...cambios, otp }, { silent: true });
        if (!r.ok) {
          setError(r.text);
          return false;
        }
        d.cliente = r.data.cliente;
        firma = null;
        editando = false;
        toast(r.data.mensaje);
        tellModel(`La usuaria actualizó su perfil con firma: ${JSON.stringify(cambios)}`);
        draw();
        return true;
      },
      () => ((firma = null), draw()),
    );
    return render(header("Mi perfil", "Confirma los cambios"), panel, footer());
  }

  const campo = (label: string, key: string, valor: string, type = "text") =>
    editando
      ? h("label", { class: "f" }, label, h("input", { class: "inp", type, value: borrador[key] ?? valor, oninput: (e: Event) => (borrador[key] = (e.target as HTMLInputElement).value) }))
      : h("div", null, h("div", { class: "xs muted" }, label), h("div", { style: { fontWeight: "550" } }, valor));

  render(
    header("Mi perfil", `Clienta desde ${fecha(c.clienteDesde, { month: "long", year: "numeric" })}`),
    h(
      "div",
      { class: "card row", style: { gap: "14px" } },
      h("div", { class: "ava", style: { width: "56px", height: "56px", fontSize: "20px", background: "linear-gradient(135deg, var(--brand), var(--brand-2))", color: "white" } }, c.avatar),
      h("div", { class: "sp" }, h("div", { class: "b", style: { fontSize: "17px" } }, c.nombreCompleto), h("div", { class: "small muted" }, `${c.profesion} · DNI ${c.dni.slice(0, 2)}••••••${c.dni.slice(-2)}`), h("span", { class: "badge brand", style: { marginTop: "4px" } }, `⭐ ${c.segmento}`)),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px" } },
      h("div", { class: "row", style: { marginBottom: "10px" } }, h("div", { class: "b sp" }, "Datos de contacto"), editando ? null : h("button", { class: "btn sm", onclick: () => ((editando = true), draw()) }, "✏️ Editar")),
      h("div", { class: "grid g2" }, campo("Email", "email", c.email, "email"), campo("Teléfono", "telefono", c.telefono, "tel"), campo("Dirección", "calle", c.direccion.calle), campo("Código postal", "cp", c.direccion.cp), campo("Ciudad", "ciudad", c.direccion.ciudad)),
      editando
        ? h(
            "div",
            { class: "row", style: { marginTop: "10px", gap: "6px" } },
            h(
              "button",
              {
                class: "btn primary sm",
                onclick: () => {
                  const orig: Record<string, string> = { email: c.email, telefono: c.telefono, calle: c.direccion.calle, cp: c.direccion.cp, ciudad: c.direccion.ciudad };
                  const cambios = Object.fromEntries(Object.entries(borrador).filter(([k, v]) => v.trim() && v !== orig[k]));
                  if (!Object.keys(cambios).length) return toast("No hay cambios");
                  firma = cambios;
                  draw();
                },
              },
              "Guardar",
            ),
            h("button", { class: "btn sm", onclick: () => ((editando = false), Object.keys(borrador).forEach((k) => delete borrador[k]), draw()) }, "Cancelar"),
          )
        : null,
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px", padding: "4px 14px" } },
      pref("🔔", "Notificaciones push", c.preferencias.notificacionesPush, (v) => guardarPref({ notificacionesPush: v })),
      pref("📬", "Extractos en papel", c.preferencias.extractosPapel, (v) => guardarPref({ extractosPapel: v })),
      h(
        "div",
        { class: "item" },
        h("div", { class: "ava sm" }, "⚠️"),
        h("div", { class: "sp" }, h("div", { style: { fontWeight: "550" } }, "Avisarme si el saldo baja de"), h("div", { class: "xs muted" }, "Te enviaremos una alerta")),
        h(
          "select",
          { class: "inp", style: { width: "auto" }, onchange: (e: Event) => guardarPref({ alertasSaldo: Number((e.target as HTMLSelectElement).value) }) },
          ...[100, 300, 500, 1000].map((n) => h("option", { value: String(n), selected: n === c.preferencias.alertasSaldo }, eur(n, false))),
        ),
      ),
    ),
    h(
      "div",
      { class: "card", style: { marginTop: "10px" } },
      h("div", { class: "b", style: { marginBottom: "4px" } }, `Productos contratados (${c.productosContratados.length})`),
      h("div", { class: "list" }, ...c.productosContratados.map((p) => h("div", { class: "item" }, h("span", { class: "badge" }, p.tipo), h("div", { class: "sp ellipsis" }, h("div", { class: "ellipsis" }, p.nombre), h("div", { class: "xs muted ellipsis" }, p.detalle)), p.valor != null ? h("div", { class: "num b" }, eur(p.valor)) : null))),
    ),
    d.operaciones.length
      ? h(
          "div",
          { class: "card", style: { marginTop: "10px" } },
          h("div", { class: "b", style: { marginBottom: "4px" } }, "Operaciones recientes en esta sesión"),
          ...d.operaciones.map((o) => h("div", { class: "row small", style: { padding: "4px 0" } }, h("span", { class: `badge ${o.estado === "completada" ? "ok" : "warn"}` }, o.estado), h("span", { class: "sp ellipsis" }, o.descripcion), o.importe != null ? h("span", { class: "num" }, eur(o.importe)) : null)),
        )
      : null,
    h(
      "div",
      { class: "row wrap", style: { marginTop: "12px", gap: "6px" } },
      h("button", { class: "btn sm", onclick: () => certificado(c) }, "📄 Certificado de titularidad"),
      h("button", { class: "btn sm", onclick: () => ask("¿Cómo contacto con mi gestor?") }, `👤 Gestor: ${c.gestor.nombre}`),
    ),
    footer(),
  );
}

const pref = (ico: string, label: string, v: boolean, on: (v: boolean) => void) => h("div", { class: "item" }, h("div", { class: "ava sm" }, ico), h("div", { class: "sp", style: { fontWeight: "550" } }, label), toggle(v, on));

async function guardarPref(cambios: Record<string, unknown>) {
  // Las preferencias no son sensibles: en la demo se firman con un código automático.
  const r = await call<{ cliente: Cliente }>("actualizar_perfil", { ...cambios, otp: "111111" });
  if (r.ok) {
    d.cliente = r.data.cliente;
    toast("Preferencia guardada");
    tellModel(`La usuaria cambió sus preferencias: ${JSON.stringify(cambios)}`);
  }
}

function certificado(c: Cliente) {
  const txt = `BANCO FINORA (entidad ficticia)\nCERTIFICADO DE TITULARIDAD\n\nCertificamos que ${c.nombreCompleto}, con DNI ${c.dni}, es titular de las siguientes cuentas:\n\n${c.productosContratados
    .filter((p) => p.tipo === "Cuenta")
    .map((p) => `  · ${p.nombre}: ${p.detalle}`)
    .join("\n")}\n\nMadrid, ${fecha(new Date().toISOString().slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}\n\nDocumento de demostración sin validez.`;
  downloadText("certificado-titularidad.txt", "text/plain", txt);
}

mount<Data>({
  onData: (x) => {
    d = x;
    draw();
  },
});
