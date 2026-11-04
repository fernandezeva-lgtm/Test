// Servidor MCP "Banco Finora" con MCP Apps: cada herramienta de consulta/operativa
// declara un recurso ui:// que el host pinta como widget interactivo.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { bank, BankError, eur, PERIODOS, type Periodo } from "./bank.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WIDGETS_DIR = join(ROOT, "dist", "widgets");

export const WIDGETS = {
  posicion: "Posición global",
  movimientos: "Movimientos",
  analisis: "Análisis de gastos",
  bizum: "Bizum",
  transferencia: "Transferencia",
  tarjetas: "Tarjetas",
  recibos: "Recibos y pagos",
  catalogo: "Catálogo de productos",
  simulador: "Simulador de préstamos",
  ayuda: "Centro de ayuda",
  perfil: "Mi perfil",
  objetivos: "Objetivos de ahorro",
  inversiones: "Inversiones",
} as const;
type WidgetId = keyof typeof WIDGETS;
const uri = (w: WidgetId) => `ui://finora/${w}.html`;

function widgetHtml(w: WidgetId) {
  const file = join(WIDGETS_DIR, `${w}.html`);
  if (!existsSync(file))
    return `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:16px">Widget <b>${w}</b> sin compilar. Ejecuta <code>npm run build:widgets</code>.</body>`;
  return readFileSync(file, "utf8");
}

const ok = (texto: string, datos: object): CallToolResult => ({
  content: [{ type: "text", text: texto }],
  structuredContent: datos as Record<string, unknown>,
});
const fallo = (e: unknown): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: e instanceof BankError ? e.message : `Error inesperado: ${(e as Error).message}` }],
});
async function seguro(fn: () => CallToolResult | Promise<CallToolResult>) {
  try {
    return await fn();
  } catch (e) {
    return fallo(e);
  }
}

const RO = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const OPS = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;
const appOnly = { ui: { visibility: ["app"] as ("app" | "model")[] } };
const periodoSchema = z.enum(Object.keys(PERIODOS) as [Periodo, ...Periodo[]]);

export function createBankServer() {
  const server = new McpServer(
    {
      name: "banco-finora",
      title: "Banco Finora",
      version: "1.0.0",
      description: "Banca personal simulada con widgets MCP Apps: saldos, movimientos, Bizum, transferencias, tarjetas, productos y ayuda.",
    },
    {
      instructions:
        "Eres el asistente del Banco Finora (datos simulados). La clienta es Lucía Martín. Usa las herramientas para mostrar widgets en lugar de describir tablas largas. " +
        "Las operaciones con dinero (Bizum, transferencias, pagos, contratación) SIEMPRE se preparan con su herramienta y la clienta las confirma en el widget con su código de firma: nunca digas que una operación se ha ejecutado si no lo confirma el widget.",
    },
  );

  // ---------- Recursos UI ----------
  for (const [id, nombre] of Object.entries(WIDGETS) as [WidgetId, string][]) {
    registerAppResource(server, `Widget ${nombre}`, uri(id), { description: `Interfaz interactiva: ${nombre}` }, async () => ({
      contents: [{ uri: uri(id), mimeType: RESOURCE_MIME_TYPE, text: widgetHtml(id), _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] } } } }],
    }));
  }

  // ---------- Consultas con widget ----------
  registerAppTool(
    server,
    "posicion_global",
    {
      title: "Posición global",
      description:
        "Resumen financiero de la clienta: patrimonio neto, saldos de cuentas, tarjetas, préstamos, inversiones, ingresos/gastos del mes, evolución del saldo y alertas importantes. Úsala para '¿cuánto dinero tengo?', 'resumen', 'mi situación'.",
      annotations: RO,
      _meta: { ui: { resourceUri: uri("posicion") } },
    },
    async () => {
      const p = bank.posicionGlobal();
      return ok(
        `Posición global a ${p.fecha}: patrimonio neto ${eur(p.patrimonioNeto)} (liquidez ${eur(p.liquidez)}, inversiones ${eur(p.invertido)}, vivienda estimada ${eur(p.inmuebles)}, deuda ${eur(p.deuda)}). ` +
          `Cuentas: ${p.cuentas.map((c) => `${c.alias} ${eur(c.saldo)}`).join("; ")}. ` +
          `Este mes: ingresos ${eur(p.mesActual.ingresos)}, gastos ${eur(p.mesActual.gastos)}. Mes anterior: ingresos ${eur(p.mesAnterior.ingresos)}, gastos ${eur(p.mesAnterior.gastos)}. ` +
          `Alertas: ${p.alertas.map((a) => `[${a.nivel}] ${a.titulo}: ${a.texto}`).join(" | ")}`,
        p,
      );
    },
  );

  const filtroMov = z.object({
    texto: z.string().optional().describe("Texto a buscar en concepto o comercio (p.ej. 'Mercadona', 'Netflix')"),
    categoria: z.string().optional().describe("Categoría exacta, p.ej. Supermercado, Restaurantes, Suscripciones, Viajes, Bizum, Vivienda"),
    cuentaId: z.enum(["cta-nomina", "cta-ahorro"]).optional(),
    tarjetaId: z.enum(["tj-debito", "tj-credito", "tj-virtual"]).optional(),
    desde: z.string().optional().describe("Fecha inicio YYYY-MM-DD"),
    hasta: z.string().optional().describe("Fecha fin YYYY-MM-DD"),
    tipo: z.enum(["ingresos", "gastos", "todos"]).optional(),
    importeMin: z.number().optional(),
    importeMax: z.number().optional(),
    pagina: z.number().int().optional(),
    porPagina: z.number().int().optional(),
  });
  const resumenMovs = (r: ReturnType<typeof bank.buscarMovimientos>) =>
    `${r.total} movimientos encontrados (ingresos ${eur(r.totalIngresos)}, gastos ${eur(r.totalGastos)}). ` +
    `Primeros: ${r.movimientos
      .slice(0, 12)
      .map((m) => `${m.fecha} ${m.concepto} ${eur(m.importe)} [${m.categoria}${m.estado !== "completado" ? `, ${m.estado}` : ""}] id=${m.id}`)
      .join("; ")}`;

  registerAppTool(
    server,
    "ver_movimientos",
    {
      title: "Ver movimientos",
      description:
        `Muestra un listado interactivo de movimientos (últimos 2 años) con filtros. Hoy es ${bank.hoy}. Úsala para '¿en qué gasté…?', 'movimientos de…', 'cargos de Amazon', etc.`,
      inputSchema: filtroMov,
      annotations: RO,
      _meta: { ui: { resourceUri: uri("movimientos") } },
    },
    async (args) => {
      const r = bank.buscarMovimientos(args);
      return ok(resumenMovs(r), r);
    },
  );

  server.registerTool(
    "buscar_movimientos",
    {
      title: "Buscar movimientos (datos)",
      description: "Busca movimientos y devuelve los datos sin widget. Útil para cálculos o cuando el widget ya está en pantalla.",
      inputSchema: filtroMov,
      annotations: RO,
    },
    async (args) => {
      const r = bank.buscarMovimientos(args);
      return ok(resumenMovs(r), r);
    },
  );

  registerAppTool(
    server,
    "analizar_gastos",
    {
      title: "Análisis de gastos",
      description:
        "Gráficos de gastos por categoría, evolución mensual de ingresos vs gastos, principales comercios y comparación con el periodo anterior. Úsala para '¿en qué gasto más?', 'compara mis gastos', 'ahorro'.",
      inputSchema: z.object({
        periodo: periodoSchema.optional().describe("mes_actual | mes_anterior | 3m | 6m | 12m | 24m | anio_actual (por defecto 6m)"),
        categoria: z.string().optional().describe("Limitar a una categoría"),
      }),
      annotations: RO,
      _meta: { ui: { resourceUri: uri("analisis") } },
    },
    async ({ periodo, categoria }) => {
      const a = bank.analizarGastos(periodo ?? "6m", categoria);
      return ok(
        `${a.etiqueta} (${a.desde} a ${a.hasta}): gastos ${eur(a.totalGastos)}, ingresos ${eur(a.totalIngresos)}, tasa de ahorro ${a.tasaAhorro}%. ` +
          `Por categoría: ${a.porCategoria.map((c) => `${c.categoria} ${eur(c.total)} (${c.porcentaje}%${c.variacion != null ? `, ${c.variacion > 0 ? "+" : ""}${c.variacion}% vs periodo anterior` : ""})`).join("; ")}. ` +
          `Top comercios: ${a.topComercios.map((c) => `${c.comercio} ${eur(c.total)}`).join(", ")}.`,
        a,
      );
    },
  );

  registerAppTool(
    server,
    "recibos_y_pagos",
    {
      title: "Recibos, suscripciones y pagos",
      description:
        "Recibos domiciliados, suscripciones (con subidas de precio), próximos cargos y pagos pendientes (impuestos, multas, facturas) que se pueden pagar desde el widget.",
      annotations: RO,
      _meta: { ui: { resourceUri: uri("recibos") } },
    },
    async () => {
      const r = bank.recibosYSuscripciones();
      return ok(
        `Recibos activos: gasto mensual equivalente ${eur(r.gastoMensualRecibos)} (suscripciones ${eur(r.gastoMensualSuscripciones)}). ` +
          `Próximos cargos: ${r.proximos.map((p) => `${p.fecha} ${p.emisor} ~${eur(p.importeEstimado)}`).join("; ")}. ` +
          `Alertas: ${r.recibos.filter((x) => x.alerta).map((x) => `${x.emisor}: ${x.alerta}`).join("; ")}. ` +
          `Pagos pendientes: ${r.pagosPendientes.map((p) => `${p.concepto} ${eur(p.importe)} vence ${p.vencimiento} [${p.estado}]${p.descuento ? ` (${p.descuento.motivo}: ${eur(p.descuento.importe)} hasta ${p.descuento.hasta})` : ""}`).join("; ")}`,
        r,
      );
    },
  );

  registerAppTool(
    server,
    "gestionar_tarjetas",
    {
      title: "Gestionar tarjetas",
      description:
        "Muestra las tarjetas con controles: bloqueo temporal, compras online, pagos en el extranjero, contactless y límites. Úsala para 'bloquear tarjeta', 'activar pagos en el extranjero', 'límite del cajero'. Los cambios los confirma la clienta en el widget.",
      inputSchema: z.object({
        tarjetaId: z.enum(["tj-debito", "tj-credito", "tj-virtual"]).optional().describe("Tarjeta a destacar"),
        accionSugerida: z.enum(["bloquear", "desbloquear", "activar_extranjero", "cambiar_limites"]).optional().describe("Acción que la clienta quiere hacer, para resaltarla"),
      }),
      annotations: RO,
      _meta: { ui: { resourceUri: uri("tarjetas") } },
    },
    async ({ tarjetaId, accionSugerida }) => {
      const t = bank.tarjetas();
      return ok(
        `Tarjetas: ${t.map((x) => `${x.alias} (${x.red} ${x.numero.slice(-4)}, id=${x.id}) ${x.bloqueada ? "BLOQUEADA" : "activa"}, online ${x.comprasOnline ? "sí" : "no"}, extranjero ${x.pagosExtranjero ? "sí" : "no"}, límite diario ${eur(x.limiteDiario)}, cajero ${eur(x.limiteCajero)}, gasto mes ${eur(x.gastoMes)}`).join("; ")}. Se muestra el widget para que la clienta confirme los cambios.`,
        { tarjetas: t, destacada: tarjetaId ?? null, accionSugerida: accionSugerida ?? null },
      );
    },
  );

  registerAppTool(
    server,
    "objetivos_ahorro",
    {
      title: "Objetivos de ahorro",
      description: "Huchas/objetivos de ahorro con su progreso. Desde el widget se puede aportar dinero o crear un objetivo nuevo.",
      annotations: RO,
      _meta: { ui: { resourceUri: uri("objetivos") } },
    },
    async () => {
      const o = bank.objetivos();
      return ok(o.objetivos.map((x) => `${x.emoji} ${x.nombre}: ${eur(x.ahorrado)} de ${eur(x.meta)} (${x.progreso}%), fecha ${x.fechaObjetivo}, ${x.enCamino ? "en camino" : `necesita ${eur(x.aportacionNecesaria)}/mes`}`).join("; "), o);
    },
  );

  registerAppTool(
    server,
    "mis_inversiones",
    {
      title: "Mis inversiones",
      description: "Cartera de fondos y plan de pensiones con evolución de 24 meses, rentabilidad y riesgo.",
      annotations: RO,
      _meta: { ui: { resourceUri: uri("inversiones") } },
    },
    async () => {
      const i = bank.inversiones();
      return ok(`Cartera ${eur(i.total)} (aportado ${eur(i.aportado)}). ${i.inversiones.map((x) => `${x.nombre}: ${eur(x.valor)}, rentabilidad ${x.rentabilidad}%, riesgo ${x.riesgo}/7`).join("; ")}`, i);
    },
  );

  registerAppTool(
    server,
    "mi_perfil",
    {
      title: "Mi perfil",
      description: "Datos personales de la clienta, gestor asignado, preferencias y productos contratados. Permite editar email, teléfono, dirección y preferencias desde el widget.",
      annotations: RO,
      _meta: { ui: { resourceUri: uri("perfil") } },
    },
    async () => {
      const c = bank.cliente();
      return ok(
        `${c.nombreCompleto}, DNI ${c.dni}, ${c.email}, ${c.telefono}, ${c.direccion.calle}, ${c.direccion.cp} ${c.direccion.ciudad}. Segmento ${c.segmento}, clienta desde ${c.clienteDesde}. Gestor: ${c.gestor.nombre} (${c.gestor.telefono}). Productos: ${c.productosContratados.map((p) => p.nombre).join(", ")}.`,
        { cliente: c, operaciones: bank.operaciones.slice(0, 10), consultas: bank.consultas.slice(0, 5) },
      );
    },
  );

  registerAppTool(
    server,
    "catalogo_productos",
    {
      title: "Catálogo de productos",
      description: "Catálogo de productos del banco (cuentas, tarjetas, préstamos, hipotecas, inversión, seguros, depósitos) con condiciones y botón de solicitud.",
      inputSchema: z.object({ tipo: z.enum(["cuenta", "tarjeta", "prestamo", "hipoteca", "inversion", "seguro", "deposito"]).optional() }),
      annotations: RO,
      _meta: { ui: { resourceUri: uri("catalogo") } },
    },
    async ({ tipo }) => {
      const c = bank.catalogo(tipo);
      return ok(
        c.productos.map((p) => `${p.nombre} [${p.tipo}${p.contratado ? ", ya contratado" : ""}${p.badge ? `, ${p.badge}` : ""}]: ${p.resumen} ${Object.entries(p.condiciones).map(([k, v]) => `${k}: ${v}`).join(", ")} (id=${p.id})`).join("\n"),
        { ...c, filtro: tipo ?? null },
      );
    },
  );

  registerAppTool(
    server,
    "simular_prestamo",
    {
      title: "Simulador de préstamos",
      description: "Simula un préstamo personal, de coche o una hipoteca: cuota mensual, intereses, cuadro de amortización y ratio de endeudamiento. El widget permite ajustar importe y plazo y solicitarlo.",
      inputSchema: z.object({
        tipo: z.enum(["personal", "coche", "hipoteca"]).default("personal"),
        importe: z.number().positive().optional().describe("Importe en euros"),
        plazoMeses: z.number().int().positive().optional().describe("Plazo en meses"),
      }),
      annotations: RO,
      _meta: { ui: { resourceUri: uri("simulador") } },
    },
    async ({ tipo, importe, plazoMeses }) => {
      const t = tipo ?? "personal";
      const def = { personal: [12000, 48], coche: [25000, 84], hipoteca: [220000, 300] }[t];
      const s = bank.simularPrestamo(t, importe ?? def[0], plazoMeses ?? def[1]);
      return ok(
        `Simulación ${s.producto.nombre}: ${eur(s.importe)} a ${s.plazoMeses} meses, TIN ${s.producto.tin}%. Cuota ${eur(s.cuota)}/mes, intereses totales ${eur(s.totalIntereses)}, total a pagar ${eur(s.totalPagar)}. Endeudamiento resultante ${s.endeudamiento}% (${s.viable ? "viable" : "elevado"}).`,
        s,
      );
    },
  );

  registerAppTool(
    server,
    "centro_ayuda",
    {
      title: "Centro de ayuda",
      description: "Busca en las preguntas frecuentes y muestra el centro de ayuda (con contacto del gestor y formulario de consulta). Úsala para dudas sobre funcionamiento, comisiones, seguridad, fraude, límites…",
      inputSchema: z.object({ pregunta: z.string().optional(), categoria: z.string().optional() }),
      annotations: RO,
      _meta: { ui: { resourceUri: uri("ayuda") } },
    },
    async ({ pregunta, categoria }) => {
      const f = bank.faqs(pregunta, categoria);
      return ok(f.resultados.slice(0, 4).map((x) => `P: ${x.pregunta}\nR: ${x.respuesta}`).join("\n\n"), { ...f, gestor: bank.d.cliente.gestor });
    },
  );

  // ---------- Operativa: el modelo prepara, la clienta confirma en el widget ----------
  registerAppTool(
    server,
    "enviar_bizum",
    {
      title: "Preparar Bizum",
      description:
        "Abre el formulario de Bizum (enviar o solicitar dinero) prerrellenado. NO ejecuta el envío: la clienta revisa y confirma con su código de firma en el widget.",
      inputSchema: z.object({
        contacto: z.string().optional().describe("Nombre (o parte) del contacto, p.ej. 'Marta'"),
        telefono: z.string().optional(),
        importe: z.number().positive().optional(),
        concepto: z.string().optional(),
        modo: z.enum(["enviar", "solicitar"]).default("enviar"),
      }),
      annotations: RO,
      _meta: { ui: { resourceUri: uri("bizum") } },
    },
    async (args) => {
      const datos = bank.datosOperativa();
      const q = args.contacto?.toLowerCase();
      const contacto = q ? datos.contactos.find((c) => c.nombre.toLowerCase().includes(q)) : datos.contactos.find((c) => c.telefono === args.telefono);
      return ok(
        `Formulario de Bizum listo (${args.modo ?? "enviar"}${contacto ? ` a ${contacto.nombre}` : ""}${args.importe ? `, ${eur(args.importe)}` : ""}). La clienta debe revisarlo y confirmarlo en el widget. Saldo disponible ${eur(datos.cuentas[0].saldo)}.`,
        { ...datos, propuesta: { ...args, contactoId: contacto?.id ?? null, telefono: contacto?.telefono ?? args.telefono ?? null } },
      );
    },
  );

  registerAppTool(
    server,
    "nueva_transferencia",
    {
      title: "Preparar transferencia",
      description:
        "Abre el formulario de transferencia (a beneficiarios guardados, a un IBAN nuevo o entre cuentas propias) prerrellenado. NO la ejecuta: la clienta confirma con su código de firma en el widget.",
      inputSchema: z.object({
        beneficiario: z.string().optional().describe("Nombre o alias del beneficiario"),
        iban: z.string().optional(),
        importe: z.number().positive().optional(),
        concepto: z.string().optional(),
        cuentaOrigen: z.enum(["cta-nomina", "cta-ahorro"]).optional(),
        fecha: z.string().optional().describe("YYYY-MM-DD para programarla"),
      }),
      annotations: RO,
      _meta: { ui: { resourceUri: uri("transferencia") } },
    },
    async (args) => {
      const datos = bank.datosOperativa();
      const q = args.beneficiario?.toLowerCase();
      const b = q ? datos.beneficiarios.find((x) => x.nombre.toLowerCase().includes(q) || x.alias?.toLowerCase().includes(q)) : undefined;
      const propia = q ? datos.cuentas.find((c) => c.alias.toLowerCase().includes(q)) : undefined;
      return ok(
        `Formulario de transferencia listo${b ? ` a ${b.nombre}` : propia ? ` a ${propia.alias}` : ""}${args.importe ? ` por ${eur(args.importe)}` : ""}. La clienta debe revisarlo y confirmarlo en el widget.`,
        {
          ...datos,
          propuesta: { ...args, beneficiarioId: b?.id ?? null, iban: b?.iban ?? propia?.iban ?? args.iban ?? null, nombre: b?.nombre ?? propia?.alias ?? args.beneficiario ?? null },
        },
      );
    },
  );

  // Herramientas que solo pueden invocar los widgets (visibility: ["app"]).
  server.registerTool(
    "confirmar_bizum",
    {
      title: "Confirmar Bizum",
      description: "Ejecuta un Bizum confirmado por la clienta con su código de firma.",
      inputSchema: z.object({ telefono: z.string(), importe: z.number(), concepto: z.string().optional(), modo: z.enum(["enviar", "solicitar"]), otp: z.string().optional() }),
      annotations: OPS,
      _meta: appOnly,
    },
    async (a) => seguro(() => {
      const r = bank.enviarBizum(a);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "confirmar_transferencia",
    {
      title: "Confirmar transferencia",
      description: "Ejecuta una transferencia confirmada por la clienta.",
      inputSchema: z.object({
        cuentaOrigen: z.string().optional(),
        iban: z.string(),
        beneficiario: z.string(),
        importe: z.number(),
        concepto: z.string().optional(),
        inmediata: z.boolean().optional(),
        fecha: z.string().optional(),
        guardarBeneficiario: z.boolean().optional(),
        otp: z.string().optional(),
      }),
      annotations: OPS,
      _meta: appOnly,
    },
    async (a) => seguro(() => {
      const r = bank.transferir(a);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "actualizar_tarjeta",
    {
      title: "Actualizar tarjeta",
      description: "Cambia los ajustes de una tarjeta (bloqueo, online, extranjero, contactless, límites).",
      inputSchema: z.object({
        tarjetaId: z.string(),
        bloqueada: z.boolean().optional(),
        comprasOnline: z.boolean().optional(),
        pagosExtranjero: z.boolean().optional(),
        contactless: z.boolean().optional(),
        limiteDiario: z.number().optional(),
        limiteCajero: z.number().optional(),
      }),
      annotations: OPS,
      _meta: appOnly,
    },
    async ({ tarjetaId, ...cambios }) => seguro(() => {
      const r = bank.actualizarTarjeta(tarjetaId, cambios);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "devolver_recibo",
    {
      title: "Devolver recibo",
      description: "Devuelve un recibo domiciliado (máx. 8 semanas).",
      inputSchema: z.object({ movimientoId: z.string(), motivo: z.string().optional() }),
      annotations: OPS,
      _meta: appOnly,
    },
    async ({ movimientoId, motivo }) => seguro(() => {
      const r = bank.devolverRecibo(movimientoId, motivo);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "pagar_pendiente",
    {
      title: "Pagar recibo/impuesto pendiente",
      description: "Paga un pago pendiente (impuesto, multa o factura).",
      inputSchema: z.object({ pagoId: z.string(), otp: z.string().optional() }),
      annotations: OPS,
      _meta: appOnly,
    },
    async ({ pagoId, otp }) => seguro(() => {
      const r = bank.pagarPendiente(pagoId, otp);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "aportar_objetivo",
    {
      title: "Aportar a objetivo",
      description: "Traspasa dinero de la cuenta nómina a un objetivo de ahorro.",
      inputSchema: z.object({ objetivoId: z.string(), importe: z.number() }),
      annotations: OPS,
      _meta: appOnly,
    },
    async ({ objetivoId, importe }) => seguro(() => {
      const r = bank.aportarObjetivo(objetivoId, importe);
      return ok(r.mensaje, { ...r, ...bank.objetivos() });
    }),
  );

  server.registerTool(
    "crear_objetivo",
    {
      title: "Crear objetivo de ahorro",
      description: "Crea un nuevo objetivo de ahorro.",
      inputSchema: z.object({ nombre: z.string(), emoji: z.string().optional(), meta: z.number(), fechaObjetivo: z.string(), aportacionMensual: z.number().optional() }),
      annotations: { ...OPS, destructiveHint: false },
      _meta: appOnly,
    },
    async (a) => seguro(() => {
      const r = bank.crearObjetivo(a);
      return ok(r.mensaje, { ...r, ...bank.objetivos() });
    }),
  );

  server.registerTool(
    "solicitar_producto",
    {
      title: "Solicitar producto",
      description: "Contrata o solicita un producto del catálogo.",
      inputSchema: z.object({ productoId: z.string(), detalle: z.record(z.string(), z.unknown()).optional(), otp: z.string().optional() }),
      annotations: OPS,
      _meta: appOnly,
    },
    async ({ productoId, detalle, otp }) => seguro(() => {
      const r = bank.solicitarProducto(productoId, detalle, otp);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "actualizar_perfil",
    {
      title: "Actualizar perfil",
      description: "Actualiza datos de contacto y preferencias de la clienta.",
      inputSchema: z.object({
        email: z.string().optional(),
        telefono: z.string().optional(),
        calle: z.string().optional(),
        cp: z.string().optional(),
        ciudad: z.string().optional(),
        notificacionesPush: z.boolean().optional(),
        extractosPapel: z.boolean().optional(),
        alertasSaldo: z.number().optional(),
        otp: z.string().optional(),
      }),
      annotations: OPS,
      _meta: appOnly,
    },
    async ({ otp, ...cambios }) => seguro(() => {
      const r = bank.actualizarPerfil(cambios, otp);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "crear_consulta",
    {
      title: "Crear consulta",
      description: "Abre una consulta/caso con atención al cliente.",
      inputSchema: z.object({ asunto: z.string(), mensaje: z.string() }),
      annotations: { ...OPS, destructiveHint: false },
      _meta: appOnly,
    },
    async ({ asunto, mensaje }) => seguro(() => {
      const r = bank.crearConsulta(asunto, mensaje);
      return ok(r.mensaje, r);
    }),
  );

  server.registerTool(
    "reiniciar_demo",
    {
      title: "Reiniciar datos demo",
      description: "Restaura los datos simulados del banco a su estado inicial.",
      annotations: { ...OPS, destructiveHint: false },
      _meta: appOnly,
    },
    async () => {
      bank.reset();
      return ok("Datos de demostración restaurados.", { ok: true });
    },
  );

  // ---------- Prompts (el host los muestra como sugerencias) ----------
  const prompts: [string, string, string][] = [
    ["resumen_financiero", "📊 Mi situación financiera", "Hazme un resumen de mi situación financiera y avísame si hay algo importante."],
    ["gastos_mes", "🧾 ¿En qué gasto más?", "¿En qué he gastado más en los últimos 6 meses? Compáralo con el periodo anterior."],
    ["bizum", "💸 Enviar un Bizum", "Envía un Bizum de 25 € a Marta por la cena del sábado."],
    ["tarjeta", "🔒 Revisar un cargo raro", "Veo un cargo raro de PayPal en mi tarjeta de crédito, ¿qué hago?"],
    ["prestamo", "🚗 Simular préstamo coche", "Quiero comprarme un coche eléctrico de 28.000 €, simula la financiación a 6 años."],
    ["suscripciones", "🔁 Mis suscripciones", "¿Qué suscripciones y recibos tengo? ¿Alguno ha subido de precio?"],
  ];
  for (const [name, title, text] of prompts) {
    server.registerPrompt(name, { title, description: text }, async () => ({
      messages: [{ role: "user", content: { type: "text", text } }],
    }));
  }

  return server;
}
