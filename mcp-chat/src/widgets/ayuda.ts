import { ask, call, footer, h, header, mount, openLink, render, successPanel, tellModel } from "./lib/runtime.ts";

interface Faq {
  id: string;
  categoria: string;
  pregunta: string;
  respuesta: string;
}
interface Data {
  resultados: Faq[];
  categorias: string[];
  consulta?: string;
  gestor: { nombre: string; email: string; telefono: string; oficina: string; horario: string };
}

let d: Data;
let todas: Faq[] = [];
let q = "";
let catSel: string | null = null;
let form = false;
let hecho: string | null = null;
const util = new Map<string, boolean>();

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function filtradas() {
  const words = norm(q).split(/\W+/).filter((w) => w.length > 2);
  return todas
    .filter((f) => !catSel || f.categoria === catSel)
    .map((f) => ({ f, s: words.reduce((a, w) => a + (norm(f.pregunta + " " + f.respuesta).includes(w) ? 1 : 0), 0) }))
    .filter((x) => !words.length || x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.f);
}

function draw() {
  if (hecho) return render(header("Centro de ayuda"), successPanel("Consulta registrada", hecho, h("button", { class: "btn", onclick: () => ((hecho = null), (form = false), draw()) }, "Volver")), footer());
  const lista = filtradas();
  const g = d.gestor;
  const search = h("input", {
    class: "inp",
    placeholder: "🔍 Busca tu duda: bizum, tarjeta, comisiones…",
    value: q,
    oninput: (e: Event) => {
      q = (e.target as HTMLInputElement).value;
      const pos = (e.target as HTMLInputElement).selectionStart;
      draw();
      const el = document.querySelector<HTMLInputElement>("#root input.inp");
      el?.focus();
      el?.setSelectionRange(pos, pos);
    },
  });
  render(
    header("Centro de ayuda", "Preguntas frecuentes y contacto"),
    search,
    h(
      "div",
      { class: "chips", style: { margin: "10px 0" } },
      h("span", { class: `chip${!catSel ? " on" : ""}`, onclick: () => ((catSel = null), draw()) }, "Todas"),
      ...d.categorias.map((c) => h("span", { class: `chip${catSel === c ? " on" : ""}`, onclick: () => ((catSel = catSel === c ? null : c), draw()) }, c)),
    ),
    lista.length
      ? h(
          "div",
          null,
          ...lista.slice(0, 8).map((f, i) =>
            h(
              "details",
              { class: "acc", open: i === 0 && !!(d.consulta || q) },
              h("summary", null, h("span", { class: "badge" }, f.categoria), h("span", null, f.pregunta)),
              h(
                "div",
                { class: "body" },
                h("div", null, f.respuesta),
                h(
                  "div",
                  { class: "row small", style: { marginTop: "8px", gap: "6px" } },
                  util.has(f.id)
                    ? h("span", { class: "faint" }, util.get(f.id) ? "¡Gracias! 😊" : "Gracias, lo mejoraremos.")
                    : [h("span", { class: "faint" }, "¿Te ha ayudado?"), h("button", { class: "btn sm", onclick: () => (util.set(f.id, true), draw()) }, "👍"), h("button", { class: "btn sm", onclick: () => (util.set(f.id, false), draw()) }, "👎")],
                  h("span", { class: "sp" }),
                  h("a", { class: "link", onclick: () => ask(`Tengo una duda sobre "${f.pregunta}": ¿me lo explicas aplicado a mi caso?`) }, "Preguntar al asistente →"),
                ),
              ),
            ),
          ),
        )
      : h("div", { class: "empty" }, h("div", { class: "e" }, "🤔"), "No encontramos nada. Pregunta al asistente o abre una consulta."),
    h(
      "div",
      { class: "card", style: { marginTop: "14px" } },
      h("div", { class: "row" }, h("div", { class: "ava", style: { background: "var(--brand)", color: "white" } }, g.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")), h("div", { class: "sp" }, h("div", { class: "b" }, `${g.nombre} · tu gestor`), h("div", { class: "xs muted" }, `${g.oficina} · ${g.horario}`))),
      h(
        "div",
        { class: "row wrap", style: { marginTop: "10px", gap: "6px" } },
        h("button", { class: "btn sm", onclick: () => openLink(`tel:${g.telefono.replace(/\s/g, "")}`) }, `📞 ${g.telefono}`),
        h("button", { class: "btn sm", onclick: () => openLink(`mailto:${g.email}?subject=Consulta%20desde%20el%20asistente`) }, "✉️ Email"),
        h("button", { class: "btn sm primary", onclick: () => ((form = !form), draw()) }, "📝 Abrir consulta"),
      ),
      form ? consultaForm() : null,
    ),
    h("div", { class: "banner peligro", style: { marginTop: "10px" } }, h("span", { class: "ico" }, "🛑"), h("div", null, h("div", { class: "t" }, "¿Robo o fraude?"), "Bloquea tu tarjeta al instante o llama 24h al 900 123 456."), h("a", { onclick: () => ask("Quiero bloquear mi tarjeta") }, "Bloquear →")),
    footer(),
  );
}

function consultaForm() {
  const asunto = h("select", { class: "inp" }, ...["Cargo no reconocido", "Problema con un Bizum", "Recibos y domiciliaciones", "Tarjetas", "Otro"].map((x) => h("option", null, x)));
  const msg = h("textarea", { class: "inp", rows: "3", placeholder: "Cuéntanos qué ha pasado…" });
  const err = h("div", { class: "hint err" });
  return h(
    "div",
    { class: "col fade", style: { marginTop: "10px" } },
    h("label", { class: "f" }, "Asunto", asunto),
    h("label", { class: "f" }, "Mensaje", msg),
    err,
    h(
      "button",
      {
        class: "btn primary",
        onclick: async () => {
          if (msg.value.trim().length < 10) return (err.textContent = "Describe el problema (mín. 10 caracteres)");
          const r = await call("crear_consulta", { asunto: asunto.value, mensaje: msg.value.trim() });
          if (r.ok) {
            hecho = r.text;
            tellModel(`La usuaria abrió una consulta: ${asunto.value}. ${r.text}`);
            draw();
          }
        },
      },
      "Enviar consulta",
    ),
  );
}

mount<Data>({
  onData: async (x) => {
    d = x;
    todas = x.resultados;
    q = x.consulta ?? "";
    draw();
    // Cargamos todas las FAQ para poder buscar en local sin más llamadas.
    const all = await call<Data>("centro_ayuda", {}, { silent: true });
    if (all.ok) {
      todas = all.data.resultados;
      if (!x.consulta) draw();
      else {
        // conserva el orden de relevancia de la búsqueda inicial
        const ids = new Set(x.resultados.map((f) => f.id));
        todas = [...x.resultados, ...todas.filter((f) => !ids.has(f.id))];
      }
    }
  },
});
