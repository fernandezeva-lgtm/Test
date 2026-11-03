// "LLM" de demostración sin conexión: decide herramientas con reglas sencillas y redacta
// respuestas con plantillas. Sirve para probar el host y los widgets sin ninguna API key.
import { bank, eur, type Periodo } from "../bank/bank.ts";
import type { ChatRequest, LlmEvent } from "./llm.ts";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function periodoDe(t: string): Periodo | undefined {
  if (/este mes|mes actual/.test(t)) return "mes_actual";
  if (/mes pasado|ultimo mes|mes anterior/.test(t)) return "mes_anterior";
  if (/(3|tres) meses|trimestre/.test(t)) return "3m";
  if (/(6|seis) meses|semestre|medio ano/.test(t)) return "6m";
  if (/este ano|en lo que va de ano/.test(t)) return "anio_actual";
  if (/(2|dos) anos|24 meses/.test(t)) return "24m";
  if (/ano|12 meses|doce meses/.test(t)) return "12m";
  return undefined;
}

function importeDe(t: string): number | undefined {
  const m = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(k\b|mil\b)?\s*(€|euros?|eur\b)?/);
  if (!m) return undefined;
  let n = Number(m[1].replace(/[.\s]/g, "") + (m[2] ? `.${m[2]}` : ""));
  if (m[3]) n *= 1000;
  return n > 0 ? n : undefined;
}

const CONTACTOS: [RegExp, string][] = [
  [/marta/, "Marta"],
  [/javi/, "Javier"],
  [/\bana\b|hermana/, "Ana"],
  [/pablo/, "Pablo"],
  [/lucas/, "Lucas"],
  [/irene/, "Irene"],
  [/mama|madre/, "Mamá"],
  [/dani/, "Dani"],
];
const BENEFICIARIOS: [RegExp, string][] = [
  [/hermana|\bana\b/, "Hermana"],
  [/academia|ingles|idiomas/, "Inglés"],
  [/comunidad/, "Comunidad"],
  [/fontaner|reforma/, "Reformas"],
  [/(cuenta )?ahorro/, "Ahorro"],
  [/nomina/, "Nómina"],
];
const COMERCIOS = ["mercadona", "carrefour", "lidl", "amazon", "zara", "netflix", "spotify", "repsol", "cepsa", "cabify", "uber", "renfe", "glovo", "ikea", "decathlon", "paypal", "booking", "iberia", "vueling", "ryanair", "airbnb", "steam", "farmacia", "gimnasio", "wallapop"];
const CATEGORIAS: [RegExp, string][] = [
  [/supermercado|super\b|comida de casa/, "Supermercado"],
  [/restaurante|cenas|comer fuera|delivery/, "Restaurantes"],
  [/transporte|gasolina|taxi|combustible/, "Transporte"],
  [/viaje|vacaciones|hotel|vuelo/, "Viajes"],
  [/ocio|cine|concierto/, "Ocio"],
  [/suscrip/, "Suscripciones"],
  [/bizum/, "Bizum"],
  [/salud|medic/, "Salud"],
  [/nomina|sueldo|salario/, "Nómina"],
  [/compras|ropa/, "Compras"],
  [/vivienda|hipoteca|comunidad/, "Vivienda"],
  [/luz|gas\b|agua|suministro|internet|movil/, "Suministros"],
];

interface Plan {
  text: string;
  tool?: { name: string; args: Record<string, unknown> };
}

function planificar(raw: string, tools: Set<string>): Plan {
  const t = norm(raw);
  const has = (n: string) => tools.has(n);
  const importe = importeDe(t);
  const periodo = periodoDe(t);

  // Explicar un movimiento concreto (p.ej. enviado desde el widget de movimientos)
  const ref = raw.match(/\b(MOV-[A-Z0-9]+)\b/)?.[1];
  const mov = ref ? bank.d.movimientos.find((m) => m.id === ref) : undefined;
  if (mov && !/no reconozco|fraude/.test(t)) {
    const mismos = bank.d.movimientos.filter((m) => m.comercio === mov.comercio && m.importe < 0 && m.id !== mov.id);
    const media = mismos.length ? mismos.reduce((s, m) => s - m.importe, 0) / mismos.length : 0;
    const dif = media ? ((-mov.importe - media) / media) * 100 : 0;
    return {
      text:
        `**${mov.concepto}** · ${eur(mov.importe)} el ${mov.fecha} (${mov.categoria}${mov.ubicacion ? `, ${mov.ubicacion}` : ""}).\n\n` +
        (mismos.length
          ? `Has hecho **${mismos.length + 1} operaciones** en ${mov.comercio} en los últimos 2 años, con un importe medio de ${eur(media)}. ` +
            (Math.abs(dif) < 25 ? "Este cargo está **dentro de lo habitual**. ✅" : dif > 0 ? `Este cargo es un **${Math.round(dif)}% más alto** de lo normal. 👀` : `Es un **${Math.round(-dif)}% más bajo** de lo habitual.`)
          : `Es la **primera vez** que pagas en ${mov.comercio}. Si no lo reconoces, puedo ayudarte a bloquear la tarjeta.`),
    };
  }

  // Fraude / cargo sospechoso
  if (/cargo (raro|extrano|desconocido|sospechoso)|no reconozco|fraude|paypal|digitalsrv|me han robado|robo/.test(t) && has("gestionar_tarjetas"))
    return {
      text: "Vamos a protegerte. Te muestro tus tarjetas para que puedas **bloquear temporalmente la Crédito Oro** con un clic; el bloqueo es reversible.",
      tool: { name: "gestionar_tarjetas", args: { tarjetaId: "tj-credito", accionSugerida: "bloquear" } },
    };

  if (/bizum/.test(t) && !/(como|cuanto|limite|maximo|que pasa|equivocad)/.test(t) && has("enviar_bizum")) {
    const contacto = CONTACTOS.find(([r]) => r.test(t))?.[1];
    const concepto = raw.match(/\b(?:por|para)\s+(?:la |el |los |las )?([^.,!?]{3,40})/i)?.[1];
    const modo = /pide|pidele|solicita|reclama/.test(t) ? "solicitar" : "enviar";
    return {
      text: `Te preparo el Bizum${contacto ? ` ${modo === "enviar" ? "para" : "a"} ${contacto}` : ""}. Revísalo y confírmalo con tu código de firma:`,
      tool: { name: "enviar_bizum", args: { modo, ...(contacto && { contacto }), ...(importe && { importe }), ...(concepto && { concepto }) } },
    };
  }

  if (/transfer|traspas|mueve|pasa .*(a|al) (mi )?(cuenta|hermana)|enviar? dinero|ingresa/.test(t) && has("nueva_transferencia")) {
    const beneficiario = BENEFICIARIOS.find(([r]) => r.test(t))?.[1];
    const concepto = raw.match(/\b(?:concepto|por|para)\s+(?:la |el )?([^.,!?]{3,40})/i)?.[1];
    return {
      text: "Aquí tienes el formulario de transferencia prerrellenado. Comprueba los datos antes de firmar:",
      tool: { name: "nueva_transferencia", args: { ...(beneficiario && { beneficiario }), ...(importe && { importe }), ...(concepto && { concepto }) } },
    };
  }

  if (/(simula|prestamo|hipoteca|financia|credito para|cuota)/.test(t) && !/tarjeta/.test(t) && has("simular_prestamo")) {
    const tipo = /hipoteca|casa|piso|vivienda/.test(t) ? "hipoteca" : /coche|vehiculo|moto|electrico/.test(t) ? "coche" : "personal";
    const anios = t.match(/(\d+)\s*anos?/)?.[1];
    const meses = t.match(/(\d+)\s*meses/)?.[1];
    const plazoMeses = anios ? Number(anios) * 12 : meses ? Number(meses) : undefined;
    return {
      text: `Te preparo una simulación de ${tipo === "hipoteca" ? "hipoteca" : tipo === "coche" ? "préstamo coche" : "préstamo personal"}. Mueve los controles para ajustar importe y plazo:`,
      tool: { name: "simular_prestamo", args: { tipo, ...(importe && { importe }), ...(plazoMeses && { plazoMeses }) } },
    };
  }

  if (/tarjeta|bloque|\bpin\b|extranjero|cajero|contactless|limite de (la )?tarjeta/.test(t) && !/^(como|que)\b/.test(t) && has("gestionar_tarjetas")) {
    const tarjetaId = /credito|oro/.test(t) ? "tj-credito" : /debito/.test(t) ? "tj-debito" : /virtual/.test(t) ? "tj-virtual" : undefined;
    const accionSugerida = /desbloque/.test(t) ? "desbloquear" : /bloque/.test(t) ? "bloquear" : /extranjero|viaje/.test(t) ? "activar_extranjero" : /limite|cajero/.test(t) ? "cambiar_limites" : undefined;
    return { text: "Estas son tus tarjetas. Puedes cambiar cualquier ajuste al momento:", tool: { name: "gestionar_tarjetas", args: { ...(tarjetaId && { tarjetaId }), ...(accionSugerida && { accionSugerida }) } } };
  }

  if (/recibo|suscrip|domicilia|factura|multa|impuesto|\bibi\b|pagos? pendiente|subid[ao] de precio|netflix|spotify/.test(t) && has("recibos_y_pagos"))
    return { text: "Estos son tus recibos, suscripciones y pagos pendientes:", tool: { name: "recibos_y_pagos", args: {} } };

  if (/invers|fondo|cartera|pension|rentabilidad|bolsa/.test(t) && !/contratar|producto/.test(t) && has("mis_inversiones"))
    return { text: "Así va tu cartera de inversión:", tool: { name: "mis_inversiones", args: {} } };

  if (/objetivo|hucha|meta|ahorrar para|japon/.test(t) && has("objetivos_ahorro"))
    return { text: "Estos son tus objetivos de ahorro:", tool: { name: "objetivos_ahorro", args: {} } };

  if (/producto|catalogo|contratar|ofrece|ofertas?|seguro|deposito|remunerada|tarjeta viajera/.test(t) && has("catalogo_productos")) {
    const tipo = /seguro/.test(t) ? "seguro" : /deposito/.test(t) ? "deposito" : /hipoteca/.test(t) ? "hipoteca" : /tarjeta/.test(t) ? "tarjeta" : /cuenta/.test(t) ? "cuenta" : /fondo|invers/.test(t) ? "inversion" : undefined;
    return { text: "Te enseño nuestro catálogo. He marcado lo que ya tienes contratado:", tool: { name: "catalogo_productos", args: tipo ? { tipo } : {} } };
  }

  if (/(gast\w* mas|en que gast|analiza|analisis|compara|categoria|tasa de ahorro|cuanto ahorro|grafic|evolucion de (mis )?gastos|presupuesto)/.test(t) && has("analizar_gastos")) {
    const categoria = CATEGORIAS.find(([r]) => r.test(t))?.[1];
    return { text: "Analizo tus gastos:", tool: { name: "analizar_gastos", args: { periodo: periodo ?? "6m", ...(categoria && { categoria }) } } };
  }

  if (/movimiento|cargo|compra|gaste|pague|transacc|ingreso|nomina|extracto|cuanto (me )?(he )?gastado/.test(t) || COMERCIOS.some((c) => t.includes(c))) {
    if (has("ver_movimientos")) {
      const texto = COMERCIOS.find((c) => t.includes(c));
      const categoria = texto ? undefined : CATEGORIAS.find(([r]) => r.test(t))?.[1];
      const r = periodo ? bank.rango(periodo) : undefined;
      return {
        text: "Aquí tienes los movimientos. Puedes filtrar, buscar y ver el detalle de cada uno:",
        tool: {
          name: "ver_movimientos",
          args: {
            ...(texto && { texto }),
            ...(categoria && { categoria }),
            ...(r && { desde: r.desde, hasta: r.hasta }),
            ...(/ingreso|nomina/.test(t) && { tipo: "ingresos" }),
          },
        },
      };
    }
  }

  if (/perfil|mis datos|direccion|correo|email|telefono|gestor|datos personales/.test(t) && has("mi_perfil"))
    return { text: "Estos son tus datos. Puedes editarlos desde aquí:", tool: { name: "mi_perfil", args: {} } };

  if (/(como|que hago|ayuda|duda|faq|limite|comision|phishing|sms|puedo|cuanto tarda|horario|certificado)/.test(t) && has("centro_ayuda"))
    return { text: "Esto es lo que te puede ayudar:", tool: { name: "centro_ayuda", args: { pregunta: raw } } };

  if (/saldo|cuanto (dinero )?tengo|resumen|situacion|posicion|patrimonio|mis cuentas|como voy|dinero/.test(t) && has("posicion_global"))
    return { text: "Este es tu resumen financiero:", tool: { name: "posicion_global", args: {} } };

  if (/^(hola|buenas|hey|buenos dias|buenas tardes)/.test(t))
    return {
      text: `¡Hola, ${bank.d.cliente.nombre}! 👋 Soy tu asistente de Banco Finora (modo demo sin LLM). Puedo enseñarte tu **posición global**, **movimientos**, **análisis de gastos**, preparar **Bizums y transferencias**, gestionar tus **tarjetas**, **recibos**, **simular préstamos** y mucho más. ¿Qué necesitas?`,
    };

  return {
    text:
      "Estoy en **modo demo** (reglas, sin LLM real), así que entiendo frases sencillas. Prueba con: *“¿cuánto dinero tengo?”*, *“¿en qué gasto más?”*, *“movimientos de Mercadona”*, *“envía 20 € a Marta por Bizum”*, *“bloquea mi tarjeta de crédito”*, *“simula un préstamo de 15.000 €”* o *“¿qué productos tenéis?”*. " +
      "Para conversación libre, configura un LLM gratuito (Groq, Gemini u OpenRouter) en ⚙️ Ajustes.",
  };
}

function redactar(tool: string, args: Record<string, any>, resultado: string, isError: boolean): string {
  if (isError) return `No he podido completarlo: ${resultado}`;
  try {
    switch (tool) {
      case "posicion_global": {
        const p = bank.posicionGlobal();
        const al = p.alertas.find((a) => a.nivel === "peligro") ?? p.alertas[0];
        return (
          `Tu patrimonio neto es de **${eur(p.patrimonioNeto)}**: ${eur(p.liquidez)} en cuentas, ${eur(p.invertido)} invertidos y tu vivienda (valorada en ${eur(p.inmuebles)}), con ${eur(p.deuda)} de deuda (principalmente la hipoteca). ` +
          `En lo que va de mes llevas ${eur(p.mesActual.gastos)} de gastos.` +
          (al ? `\n\n⚠️ **${al.titulo}**: ${al.texto}` : "")
        );
      }
      case "analizar_gastos": {
        const a = bank.analizarGastos(args.periodo ?? "6m", args.categoria);
        const top = a.porCategoria.slice(0, 3);
        const sube = a.porCategoria.filter((c) => c.variacion != null && c.variacion > 15 && c.total > 100).sort((x, y) => y.variacion! - x.variacion!)[0];
        return (
          `En **${a.etiqueta.toLowerCase()}** has gastado **${eur(a.totalGastos)}** (unos ${eur(a.mediaMensualGastos)} al mes) y tu tasa de ahorro es del **${a.tasaAhorro}%**. ` +
          `Lo que más pesa: ${top.map((c) => `${c.categoria} (${c.porcentaje}%)`).join(", ")}.` +
          (sube ? `\n\n📈 Ojo con **${sube.categoria}**: ha subido un ${sube.variacion}% respecto al periodo anterior.` : "")
        );
      }
      case "ver_movimientos":
      case "buscar_movimientos": {
        const r = bank.buscarMovimientos(args);
        return `He encontrado **${r.total} movimientos**${args.texto ? ` de "${args.texto}"` : args.categoria ? ` en ${args.categoria}` : ""}: ${eur(r.totalGastos)} en cargos${r.totalIngresos ? ` y ${eur(r.totalIngresos)} en abonos` : ""}. Pulsa cualquiera para ver el detalle.`;
      }
      case "enviar_bizum":
        return "Cuando lo confirmes en el formulario, el dinero llegará al instante. 🔐 *En la demo vale cualquier código de 6 dígitos.*";
      case "nueva_transferencia":
        return "Las transferencias inmediatas son gratuitas y llegan en segundos. 🔐 *En la demo vale cualquier código de 6 dígitos.*";
      case "gestionar_tarjetas":
        return args.accionSugerida === "bloquear"
          ? "He resaltado el interruptor de **bloqueo temporal**. Si después confirmas que no reconoces el cargo, abre una consulta desde el centro de ayuda para tramitarlo como fraude."
          : "Los cambios se aplican al instante y puedes revertirlos cuando quieras.";
      case "recibos_y_pagos": {
        const r = bank.recibosYSuscripciones();
        const alertas = r.recibos.filter((x) => x.alerta && x.proximoCargo !== "Cancelado");
        const multa = r.pagosPendientes.find((p) => p.descuento && p.estado === "pendiente");
        return (
          `Pagas unos **${eur(r.gastoMensualRecibos)} al mes** en recibos, de los que ${eur(r.gastoMensualSuscripciones)} son suscripciones.` +
          (alertas.length ? `\n\n🔔 ${alertas.map((a) => `**${a.emisor}**: ${a.alerta}`).join(" · ")}` : "") +
          (multa ? `\n\n💡 Si pagas la multa antes del ${multa.descuento!.hasta} solo pagarás ${eur(multa.descuento!.importe)}.` : "")
        );
      }
      case "simular_prestamo":
        return `${resultado.split(". ").slice(0, 3).join(". ")}.`;
      case "catalogo_productos":
        return "Te recomiendo echar un vistazo a la **Cuenta Remunerada Plus** (2,25% TAE): con tu saldo en la cuenta de ahorro ganarías bastante más que ahora.";
      case "mis_inversiones": {
        const i = bank.inversiones();
        return `Tu cartera vale **${eur(i.total)}** frente a ${eur(i.aportado)} aportados: una ganancia de ${eur(i.total - i.aportado)}.`;
      }
      case "objetivos_ahorro":
        return "Puedes aportar a cualquier objetivo o crear uno nuevo directamente desde la tarjeta.";
      case "mi_perfil":
        return "Cualquier cambio de datos de contacto requiere tu código de firma.";
      case "centro_ayuda":
        return resultado.split("\n\n")[0]?.replace(/^P: /, "**").replace("\nR: ", "**\n\n") ?? "";
      default:
        return resultado.slice(0, 400);
    }
  } catch {
    return resultado.slice(0, 400);
  }
}

function insight(prompt: string): string {
  const t = norm(prompt);
  if (/gasto|categor|ahorro/.test(t)) {
    const a = bank.analizarGastos("6m");
    const sube = a.porCategoria.filter((c) => c.variacion != null && c.total > 100).sort((x, y) => y.variacion! - x.variacion!)[0];
    const baja = a.porCategoria.filter((c) => c.variacion != null && c.total > 100).sort((x, y) => x.variacion! - y.variacion!)[0];
    return (
      `• Ahorras el ${a.tasaAhorro}% de lo que ingresas: ${a.tasaAhorro > 20 ? "¡muy por encima de la media!" : "hay margen de mejora."}\n` +
      (sube ? `• ${sube.categoria} sube un ${sube.variacion}% (${eur(sube.total - sube.anterior)} más que el periodo anterior).\n` : "") +
      (baja ? `• Bien hecho en ${baja.categoria}: ${baja.variacion}%.\n` : "") +
      `• Reto: recortar un 10% en ${a.porCategoria[1]?.categoria ?? "compras"} te ahorraría ${eur((a.porCategoria[1]?.total ?? 0) * 0.1)} en 6 meses.`
    );
  }
  return "Resumen generado en modo demo: configura un LLM gratuito para obtener análisis personalizados.";
}

async function* stream(text: string, signal?: AbortSignal): AsyncGenerator<LlmEvent> {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const p of parts) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, 12));
    yield { type: "text", delta: p };
  }
}

export async function* demoChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<LlmEvent> {
  const msgs = req.messages;
  const last = msgs[msgs.length - 1];
  const tools = new Set((req.tools ?? []).map((t) => t.function.name));

  // Sampling desde un widget (sin herramientas): genera un "insight".
  if (!req.tools?.length) {
    yield* stream(insight(msgs.map((m) => m.content ?? "").join("\n")), signal);
    yield { type: "done", finish: "stop" };
    return;
  }

  if (last?.role === "tool") {
    // Redactar la respuesta final a partir de los resultados de herramientas del último turno.
    const idxAsis = msgs.map((m) => m.role).lastIndexOf("assistant");
    const asis = msgs[idxAsis];
    const textos: string[] = [];
    for (const tc of asis?.tool_calls ?? []) {
      const res = msgs.find((m) => m.role === "tool" && m.tool_call_id === tc.id);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        /* ignore */
      }
      const content = res?.content ?? "";
      textos.push(redactar(tc.function.name, args, content.replace(/^ERROR: /, ""), content.startsWith("ERROR:")));
    }
    yield* stream(textos.join("\n\n"), signal);
    yield { type: "done", finish: "stop" };
    return;
  }

  const userText = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
  const plan = planificar(userText, tools);
  yield* stream(plan.text, signal);
  if (plan.tool) {
    yield { type: "tool_call", id: `demo_${Date.now().toString(36)}`, name: plan.tool.name, arguments: JSON.stringify(plan.tool.args) };
    yield { type: "done", finish: "tool_calls" };
  } else yield { type: "done", finish: "stop" };
}
