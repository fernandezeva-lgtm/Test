// "Core banking" simulado en memoria: consultas y operativa sobre los datos generados.
import { FAQS, PRODUCTOS } from "./catalog.ts";
import { addDays, addMonths, generarDatos, iso, type BankData } from "./generator.ts";
import type { Categoria, Movimiento, Operacion, Tarjeta } from "./types.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const fechaTxt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" });
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export class BankError extends Error {}

export type Periodo = "mes_actual" | "mes_anterior" | "3m" | "6m" | "12m" | "24m" | "anio_actual";
export const PERIODOS: Record<Periodo, string> = {
  mes_actual: "Este mes",
  mes_anterior: "Mes anterior",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  "24m": "Últimos 24 meses",
  anio_actual: "Este año",
};

export interface FiltroMovimientos {
  cuentaId?: string;
  categoria?: string;
  texto?: string;
  desde?: string;
  hasta?: string;
  tipo?: "ingresos" | "gastos" | "todos";
  tarjetaId?: string;
  importeMin?: number;
  importeMax?: number;
  pagina?: number;
  porPagina?: number;
}

class Bank {
  d: BankData = generarDatos();
  operaciones: Operacion[] = [];
  solicitudes: { id: string; productoId: string; nombre: string; fecha: string; estado: string; detalle?: Record<string, unknown> }[] = [];
  consultas: { id: string; asunto: string; mensaje: string; fecha: string; estado: string }[] = [];
  private seq = 1;

  reset() {
    this.d = generarDatos();
    this.operaciones = [];
    this.solicitudes = [];
    this.consultas = [];
  }

  get hoy() {
    return this.d.hoy;
  }

  // ---------- utilidades ----------
  private ref(prefijo: string) {
    return `${prefijo}-${Date.now().toString(36).toUpperCase()}${(this.seq++).toString().padStart(3, "0")}`;
  }

  private cuenta(id?: string) {
    const c = this.d.cuentas.find((x) => x.id === (id ?? "cta-nomina"));
    if (!c) throw new BankError(`La cuenta ${id} no existe`);
    return c;
  }

  private nuevoMovimiento(m: Omit<Movimiento, "id" | "saldo" | "fecha" | "estado"> & { estado?: Movimiento["estado"] }) {
    const c = this.cuenta(m.cuentaId);
    c.saldo = r2(c.saldo + m.importe);
    const mov: Movimiento = {
      ...m,
      id: `MOV-N${String(this.seq++).padStart(4, "0")}`,
      fecha: this.hoy,
      saldo: c.saldo,
      estado: m.estado ?? "completado",
    };
    this.d.movimientos.push(mov);
    return mov;
  }

  private registrar(tipo: string, descripcion: string, importe?: number) {
    const op: Operacion = {
      id: `OP-${this.operaciones.length + 1}`,
      fecha: new Date().toISOString(),
      tipo,
      descripcion,
      importe,
      estado: "completada",
      referencia: this.ref(tipo.slice(0, 3).toUpperCase()),
    };
    this.operaciones.unshift(op);
    return op;
  }

  verificarOtp(otp: string | undefined) {
    if (!otp || !/^\d{6}$/.test(otp)) throw new BankError("Introduce el código de firma de 6 dígitos que te hemos enviado al móvil.");
    if (otp === "000000") throw new BankError("Código de firma incorrecto. Revisa el SMS e inténtalo de nuevo.");
  }

  rango(periodo: Periodo): { desde: string; hasta: string; etiqueta: string } {
    const h = new Date(this.hoy);
    const y = h.getFullYear();
    const m = h.getMonth();
    const first = (yy: number, mm: number) => iso(new Date(yy, mm, 1));
    const last = (yy: number, mm: number) => iso(new Date(yy, mm + 1, 0));
    switch (periodo) {
      case "mes_actual":
        return { desde: first(y, m), hasta: this.hoy, etiqueta: PERIODOS[periodo] };
      case "mes_anterior":
        return { desde: first(y, m - 1), hasta: last(y, m - 1), etiqueta: PERIODOS[periodo] };
      case "anio_actual":
        return { desde: `${y}-01-01`, hasta: this.hoy, etiqueta: PERIODOS[periodo] };
      default: {
        const n = parseInt(periodo);
        return { desde: first(y, m - n + 1), hasta: this.hoy, etiqueta: PERIODOS[periodo] };
      }
    }
  }

  // ---------- consultas ----------
  cliente() {
    const { cliente } = this.d;
    return {
      ...cliente,
      nombreCompleto: `${cliente.nombre} ${cliente.apellidos}`,
      productosContratados: this.productosContratados(),
    };
  }

  productosContratados() {
    return [
      ...this.d.cuentas.map((c) => ({ tipo: "Cuenta", nombre: c.alias, detalle: c.iban, valor: c.saldo })),
      ...this.d.tarjetas.map((t) => ({ tipo: "Tarjeta", nombre: t.alias, detalle: `${t.red} ${t.numero.slice(-4)}`, valor: t.tipo === "credito" ? -(t.dispuesto ?? 0) : null })),
      ...this.d.prestamos.map((p) => ({ tipo: "Préstamo", nombre: p.nombre, detalle: `Cuota ${eur(p.cuota)}`, valor: -p.capitalPendiente })),
      ...this.d.inversiones.map((i) => ({ tipo: "Inversión", nombre: i.nombre, detalle: `Riesgo ${i.riesgo}/7`, valor: i.valor })),
      ...this.d.seguros.map((s) => ({ tipo: "Seguro", nombre: s.nombre, detalle: s.cobertura, valor: null })),
    ];
  }

  posicionGlobal() {
    const { cuentas, tarjetas, prestamos, inversiones, seguros } = this.d;
    const liquidez = r2(cuentas.reduce((s, c) => s + c.saldo, 0));
    const invertido = r2(inversiones.reduce((s, i) => s + i.valor, 0));
    const deuda = r2(prestamos.reduce((s, p) => s + p.capitalPendiente, 0) + tarjetas.reduce((s, t) => s + (t.dispuesto ?? 0), 0));
    const inmuebles = 265000; // valor estimado de la vivienda habitual
    const mesAct = this.resumenPeriodo(this.rango("mes_actual"));
    const mesAnt = this.resumenPeriodo(this.rango("mes_anterior"));

    // Evolución de liquidez (saldo a fin de mes de los últimos 12 meses)
    const evolucion: { mes: string; saldo: number }[] = [];
    const h = new Date(this.hoy);
    for (let i = 11; i >= 0; i--) {
      const fin = i === 0 ? this.hoy : iso(new Date(h.getFullYear(), h.getMonth() - i + 1, 0));
      let total = 0;
      for (const c of cuentas) {
        const ms = this.d.movimientos.filter((m) => m.cuentaId === c.id && m.fecha <= fin);
        total += ms.length ? ms[ms.length - 1].saldo : c.saldoInicial;
      }
      evolucion.push({ mes: fin.slice(0, 7), saldo: r2(total) });
    }

    return {
      cliente: { nombre: this.d.cliente.nombre, nombreCompleto: `${this.d.cliente.nombre} ${this.d.cliente.apellidos}`, segmento: this.d.cliente.segmento },
      fecha: this.hoy,
      patrimonioNeto: r2(liquidez + invertido + inmuebles - deuda),
      inmuebles,
      liquidez,
      invertido,
      deuda,
      cuentas: cuentas.map(({ id, alias, iban, saldo, tipo, tae }) => ({ id, alias, iban, saldo, tipo, tae })),
      tarjetas: tarjetas.map(({ id, alias, numero, tipo, red, bloqueada, limiteCredito, dispuesto, color }) => ({ id, alias, numero, tipo, red, bloqueada, limiteCredito, dispuesto, color })),
      prestamos,
      inversiones: inversiones.map(({ id, nombre, valor, aportado, tipo, riesgo }) => ({ id, nombre, valor, aportado, tipo, riesgo, rentabilidad: r2(((valor - aportado) / aportado) * 100) })),
      seguros,
      mesActual: mesAct,
      mesAnterior: mesAnt,
      evolucion,
      alertas: this.alertas(),
      ultimosMovimientos: this.d.movimientos.slice(-5).reverse(),
    };
  }

  alertas() {
    const out: { nivel: "info" | "aviso" | "peligro" | "exito"; titulo: string; texto: string; accion?: string }[] = [];
    const sosp = this.d.movimientos.find((m) => m.comercio.startsWith("PayPal *DIGITALSRV") && m.estado === "completado");
    if (sosp)
      out.push({
        nivel: "peligro",
        titulo: "Cargo poco habitual",
        texto: `${eur(-sosp.importe)} en "${sosp.comercio}" desde ${sosp.ubicacion} con tu Crédito Oro el ${fechaTxt(sosp.fecha)}.`,
        accion: "¿Reconoces el cargo de PayPal DIGITALSRV? Si no, bloquea la tarjeta de crédito",
      });
    const multa = this.d.pagosPendientes.find((p) => p.id === "pp-multa" && p.estado === "pendiente");
    if (multa?.descuento)
      out.push({ nivel: "aviso", titulo: "Multa con 50% de descuento", texto: `Paga antes del ${fechaTxt(multa.descuento.hasta)} y ahorra ${eur(multa.importe - multa.descuento.importe)}.`, accion: "Enséñame mis pagos pendientes" });
    for (const r of this.d.recibos.filter((r) => r.alerta && r.proximoCargo !== "Cancelado").slice(0, 2))
      out.push({ nivel: "info", titulo: `Recibo de ${r.emisor}`, texto: r.alerta!, accion: "Muéstrame mis recibos y suscripciones" });
    const japon = this.d.objetivos.find((o) => o.id === "obj-japon");
    if (japon) out.push({ nivel: "exito", titulo: `${japon.emoji} ${japon.nombre}`, texto: `Llevas el ${Math.round((japon.ahorrado / japon.meta) * 100)}% ahorrado. ¡Sigue así!`, accion: "Ver mis objetivos de ahorro" });
    return out;
  }

  private esInterno(m: Movimiento) {
    return m.categoria === "Ahorro";
  }

  resumenPeriodo(r: { desde: string; hasta: string; etiqueta?: string }) {
    const ms = this.d.movimientos.filter((m) => m.fecha >= r.desde && m.fecha <= r.hasta && !this.esInterno(m) && m.estado !== "devuelto");
    const ingresos = r2(ms.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0));
    const gastos = r2(-ms.filter((m) => m.importe < 0).reduce((s, m) => s + m.importe, 0));
    return { desde: r.desde, hasta: r.hasta, etiqueta: r.etiqueta, ingresos, gastos, ahorro: r2(ingresos - gastos), numMovimientos: ms.length };
  }

  categorias(): Categoria[] {
    return [...new Set(this.d.movimientos.map((m) => m.categoria))].sort() as Categoria[];
  }

  buscarMovimientos(f: FiltroMovimientos) {
    const texto = f.texto ? norm(f.texto) : "";
    const cat = f.categoria ? norm(f.categoria) : "";
    let ms = this.d.movimientos.filter((m) => {
      if (f.cuentaId && m.cuentaId !== f.cuentaId) return false;
      if (f.tarjetaId && m.tarjetaId !== f.tarjetaId) return false;
      if (cat && norm(m.categoria) !== cat) return false;
      if (f.desde && m.fecha < f.desde) return false;
      if (f.hasta && m.fecha > f.hasta) return false;
      if (f.tipo === "ingresos" && m.importe <= 0) return false;
      if (f.tipo === "gastos" && m.importe >= 0) return false;
      if (f.importeMin != null && Math.abs(m.importe) < f.importeMin) return false;
      if (f.importeMax != null && Math.abs(m.importe) > f.importeMax) return false;
      if (texto && !norm(`${m.concepto} ${m.comercio} ${m.categoria} ${m.ubicacion ?? ""}`).includes(texto)) return false;
      return true;
    });
    ms = ms.slice().reverse();
    const porPagina = Math.min(Math.max(f.porPagina ?? 25, 1), 200);
    const pagina = Math.max(f.pagina ?? 1, 1);
    const total = ms.length;
    return {
      filtros: { ...f, pagina, porPagina },
      total,
      paginas: Math.max(1, Math.ceil(total / porPagina)),
      totalIngresos: r2(ms.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0)),
      totalGastos: r2(-ms.filter((m) => m.importe < 0).reduce((s, m) => s + m.importe, 0)),
      movimientos: ms.slice((pagina - 1) * porPagina, pagina * porPagina),
      opciones: {
        cuentas: this.d.cuentas.map((c) => ({ id: c.id, alias: c.alias })),
        tarjetas: this.d.tarjetas.map((t) => ({ id: t.id, alias: t.alias })),
        categorias: this.categorias(),
        rangoFechas: { min: this.d.movimientos[0]?.fecha, max: this.hoy },
      },
    };
  }

  analizarGastos(periodo: Periodo = "6m", categoria?: string) {
    const r = this.rango(periodo);
    const ms = this.d.movimientos.filter((m) => m.fecha >= r.desde && m.fecha <= r.hasta && !this.esInterno(m) && m.estado !== "devuelto");
    const gastos = ms.filter((m) => m.importe < 0 && (!categoria || norm(m.categoria) === norm(categoria)));

    const porCategoria = new Map<string, number>();
    const porComercio = new Map<string, { total: number; n: number; categoria: string }>();
    for (const m of gastos) {
      porCategoria.set(m.categoria, (porCategoria.get(m.categoria) ?? 0) - m.importe);
      const c = porComercio.get(m.comercio) ?? { total: 0, n: 0, categoria: m.categoria };
      c.total -= m.importe;
      c.n++;
      porComercio.set(m.comercio, c);
    }
    const totalGastos = r2([...porCategoria.values()].reduce((s, v) => s + v, 0));

    // Periodo anterior equivalente para comparar por categoría
    const dias = (new Date(r.hasta).getTime() - new Date(r.desde).getTime()) / 86400000 + 1;
    const antHasta = iso(addDays(new Date(r.desde), -1));
    const antDesde = iso(addDays(new Date(r.desde), -dias));
    const antCat = new Map<string, number>();
    for (const m of this.d.movimientos)
      if (m.fecha >= antDesde && m.fecha <= antHasta && m.importe < 0 && !this.esInterno(m)) antCat.set(m.categoria, (antCat.get(m.categoria) ?? 0) - m.importe);

    // Serie mensual (siempre al menos 6 meses para el gráfico)
    const meses: { mes: string; ingresos: number; gastos: number }[] = [];
    const h = new Date(this.hoy);
    const nMeses = Math.max(6, Math.min(24, Math.round(dias / 30)));
    for (let i = nMeses - 1; i >= 0; i--) {
      const key = iso(new Date(h.getFullYear(), h.getMonth() - i, 1)).slice(0, 7);
      const mm = this.d.movimientos.filter((m) => m.fecha.startsWith(key) && !this.esInterno(m) && m.estado !== "devuelto");
      meses.push({
        mes: key,
        ingresos: r2(mm.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0)),
        gastos: r2(-mm.filter((m) => m.importe < 0 && (!categoria || norm(m.categoria) === norm(categoria))).reduce((s, m) => s + m.importe, 0)),
      });
    }

    const ingresos = r2(ms.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0));
    return {
      periodo,
      etiqueta: r.etiqueta,
      desde: r.desde,
      hasta: r.hasta,
      categoriaFiltrada: categoria ?? null,
      totalGastos,
      totalIngresos: ingresos,
      tasaAhorro: ingresos ? r2(((ingresos - totalGastos) / ingresos) * 100) : 0,
      mediaMensualGastos: r2(totalGastos / Math.max(1, dias / 30.4)),
      porCategoria: [...porCategoria.entries()]
        .map(([cat, total]) => ({
          categoria: cat,
          total: r2(total),
          porcentaje: r2((total / totalGastos) * 100),
          anterior: r2(antCat.get(cat) ?? 0),
          variacion: antCat.get(cat) ? r2(((total - antCat.get(cat)!) / antCat.get(cat)!) * 100) : null,
        }))
        .sort((a, b) => b.total - a.total),
      topComercios: [...porComercio.entries()]
        .map(([comercio, v]) => ({ comercio, total: r2(v.total), operaciones: v.n, categoria: v.categoria }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      meses,
      periodosDisponibles: PERIODOS,
    };
  }

  recibosYSuscripciones() {
    const recibos = this.d.recibos.map((r) => ({ ...r, historico: r.historico.slice(-12) }));
    const activos = recibos.filter((r) => r.proximoCargo !== "Cancelado");
    const mensualizar = (r: (typeof recibos)[number]) =>
      r.ultimoImporte / { mensual: 1, bimestral: 2, trimestral: 3, anual: 12 }[r.periodicidad];
    return {
      recibos,
      suscripciones: activos.filter((r) => r.categoria === "Suscripciones"),
      gastoMensualRecibos: r2(activos.reduce((s, r) => s + mensualizar(r), 0)),
      gastoMensualSuscripciones: r2(activos.filter((r) => r.categoria === "Suscripciones").reduce((s, r) => s + mensualizar(r), 0)),
      proximos: activos
        .filter((r) => r.proximoCargo <= iso(addDays(new Date(this.hoy), 30)))
        .sort((a, b) => a.proximoCargo.localeCompare(b.proximoCargo))
        .map((r) => ({ id: r.id, emisor: r.emisor, fecha: r.proximoCargo, importeEstimado: r.importeMedio })),
      pagosPendientes: this.d.pagosPendientes,
    };
  }

  tarjetas() {
    return this.d.tarjetas.map((t) => ({
      ...t,
      gastoMes: r2(-this.d.movimientos.filter((m) => m.tarjetaId === t.id && m.fecha.startsWith(this.hoy.slice(0, 7)) && m.importe < 0).reduce((s, m) => s + m.importe, 0)),
      ultimos: this.d.movimientos.filter((m) => m.tarjetaId === t.id).slice(-4).reverse(),
    }));
  }

  faqs(pregunta?: string, categoria?: string) {
    let lista = FAQS;
    if (categoria) lista = lista.filter((f) => norm(f.categoria) === norm(categoria));
    if (!pregunta) return { resultados: lista, categorias: [...new Set(FAQS.map((f) => f.categoria))] };
    const palabras = norm(pregunta)
      .split(/\W+/)
      .filter((w) => w.length > 2);
    const puntuadas = lista
      .map((f) => {
        const hay = norm(`${f.pregunta} ${f.respuesta} ${f.etiquetas.join(" ")}`);
        const score = palabras.reduce((s, w) => s + (hay.includes(w) ? 1 : 0) + (f.etiquetas.some((e) => norm(e).includes(w)) ? 2 : 0), 0);
        return { f, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.f);
    return { resultados: puntuadas.length ? puntuadas : lista.slice(0, 6), categorias: [...new Set(FAQS.map((f) => f.categoria))], consulta: pregunta };
  }

  catalogo(tipo?: string) {
    const contratados = new Set(PRODUCTOS.filter((p) => p.contratado).map((p) => p.id));
    for (const s of this.solicitudes) contratados.add(s.productoId);
    const productos = PRODUCTOS.filter((p) => !tipo || p.tipo === tipo).map((p) => ({
      ...p,
      contratado: contratados.has(p.id),
      solicitado: this.solicitudes.some((s) => s.productoId === p.id),
    }));
    return { productos, tipos: [...new Set(PRODUCTOS.map((p) => p.tipo))], solicitudes: this.solicitudes };
  }

  simularPrestamo(tipo: "personal" | "coche" | "hipoteca", importe: number, plazoMeses: number, tinOverride?: number) {
    const prod = PRODUCTOS.find((p) => p.id === { personal: "prestamo-personal", coche: "prestamo-coche", hipoteca: "hipoteca-fija" }[tipo])!;
    const tin = tinOverride ?? prod.tin!;
    const i = tin / 100 / 12;
    const cuota = i === 0 ? importe / plazoMeses : (importe * i) / (1 - Math.pow(1 + i, -plazoMeses));
    let pendiente = importe;
    const cuadro: { anio: number; intereses: number; amortizado: number; pendiente: number }[] = [];
    let accInt = 0;
    let accAm = 0;
    for (let k = 1; k <= plazoMeses; k++) {
      const int = pendiente * i;
      const am = cuota - int;
      pendiente -= am;
      accInt += int;
      accAm += am;
      if (k % 12 === 0 || k === plazoMeses) {
        cuadro.push({ anio: Math.ceil(k / 12), intereses: r2(accInt), amortizado: r2(accAm), pendiente: r2(Math.max(0, pendiente)) });
        accInt = 0;
        accAm = 0;
      }
    }
    const ingresosMensuales = 3045.18;
    const cuotasActuales = this.d.prestamos.reduce((s, p) => s + p.cuota, 0);
    const endeudamiento = r2(((cuotasActuales + cuota) / ingresosMensuales) * 100);
    return {
      producto: { id: prod.id, nombre: prod.nombre, tin, tae: prod.tae },
      tipo,
      importe,
      plazoMeses,
      cuota: r2(cuota),
      totalIntereses: r2(cuota * plazoMeses - importe),
      totalPagar: r2(cuota * plazoMeses),
      cuadroAnual: cuadro,
      endeudamiento,
      viable: endeudamiento < 40,
      preconcedido: tipo === "personal" ? 15000 : null,
      limites:
        tipo === "hipoteca"
          ? { importeMin: 30000, importeMax: 600000, plazoMin: 60, plazoMax: 360, paso: 5000 }
          : tipo === "coche"
            ? { importeMin: 6000, importeMax: 75000, plazoMin: 24, plazoMax: 120, paso: 500 }
            : { importeMin: 3000, importeMax: 60000, plazoMin: 12, plazoMax: 96, paso: 500 },
    };
  }

  inversiones() {
    const inv = this.d.inversiones.map((i) => ({ ...i, rentabilidad: r2(((i.valor - i.aportado) / i.aportado) * 100), ganancia: r2(i.valor - i.aportado) }));
    const total = r2(inv.reduce((s, i) => s + i.valor, 0));
    const serie = inv[0].historico.map((p, idx) => ({ fecha: p.fecha, valor: r2(inv.reduce((s, i) => s + (i.historico[idx]?.valor ?? 0), 0)) }));
    return { inversiones: inv, total, aportado: r2(inv.reduce((s, i) => s + i.aportado, 0)), serie };
  }

  objetivos() {
    return {
      objetivos: this.d.objetivos.map((o) => {
        const faltan = Math.max(0, o.meta - o.ahorrado);
        const mesesRestantes = Math.max(1, Math.round((new Date(o.fechaObjetivo).getTime() - new Date(this.hoy).getTime()) / (30.4 * 86400000)));
        return { ...o, progreso: r2((o.ahorrado / o.meta) * 100), faltan: r2(faltan), aportacionNecesaria: r2(faltan / mesesRestantes), enCamino: o.aportacionMensual * mesesRestantes >= faltan };
      }),
      saldoAhorro: this.cuenta("cta-ahorro").saldo,
    };
  }

  datosOperativa() {
    return {
      cuentas: this.d.cuentas.map(({ id, alias, iban, saldo }) => ({ id, alias, iban, saldo })),
      contactos: this.d.contactos,
      beneficiarios: this.d.beneficiarios,
      limites: { bizumMin: 0.5, bizumMax: 1000, transferenciaMax: 15000 },
      otpPista: "Demo: cualquier código de 6 dígitos es válido (000000 simula un error).",
    };
  }

  // ---------- operativa ----------
  enviarBizum(p: { telefono: string; importe: number; concepto?: string; modo: "enviar" | "solicitar"; otp?: string }) {
    if (p.importe < 0.5 || p.importe > 1000) throw new BankError("El importe de un Bizum debe estar entre 0,50 € y 1.000 €.");
    const contacto = this.d.contactos.find((c) => c.telefono.replace(/\s/g, "") === p.telefono.replace(/\s/g, ""));
    const nombre = contacto?.nombre ?? p.telefono;
    if (p.modo === "solicitar") {
      const op = this.registrar("bizum_solicitud", `Solicitud Bizum a ${nombre}${p.concepto ? ` · ${p.concepto}` : ""}`, p.importe);
      op.estado = "pendiente";
      return { ok: true, estado: "pendiente", mensaje: `Solicitud de ${eur(p.importe)} enviada a ${nombre}. Te avisaremos cuando la acepte.`, operacion: op };
    }
    this.verificarOtp(p.otp);
    const c = this.cuenta("cta-nomina");
    if (c.saldo < p.importe) throw new BankError(`Saldo insuficiente en ${c.alias} (${eur(c.saldo)}).`);
    const mov = this.nuevoMovimiento({
      cuentaId: c.id,
      concepto: `Bizum a ${nombre}${p.concepto ? ` · ${p.concepto}` : ""}`,
      comercio: nombre,
      categoria: "Bizum",
      tipo: "bizum",
      importe: -r2(p.importe),
    });
    const op = this.registrar("bizum", `Bizum a ${nombre}`, p.importe);
    return { ok: true, estado: "completado", mensaje: `Has enviado ${eur(p.importe)} a ${nombre}.`, operacion: op, movimiento: mov, saldoRestante: c.saldo };
  }

  transferir(p: { cuentaOrigen?: string; iban: string; beneficiario: string; importe: number; concepto?: string; inmediata?: boolean; fecha?: string; guardarBeneficiario?: boolean; otp?: string }) {
    this.verificarOtp(p.otp);
    const ibanLimpio = p.iban.replace(/\s/g, "").toUpperCase();
    if (!validarIban(ibanLimpio)) throw new BankError("El IBAN no es válido. Revisa los dígitos de control.");
    if (p.importe <= 0 || p.importe > 15000) throw new BankError("El importe debe estar entre 0,01 € y 15.000 €.");
    const origen = this.cuenta(p.cuentaOrigen);
    const propia = this.d.cuentas.find((c) => c.iban.replace(/\s/g, "") === ibanLimpio);
    if (propia && propia.id === origen.id) throw new BankError("La cuenta de origen y destino no pueden ser la misma.");
    const programada = p.fecha && p.fecha > this.hoy;
    if (!programada && origen.saldo < p.importe) throw new BankError(`Saldo insuficiente en ${origen.alias} (${eur(origen.saldo)}).`);
    if (p.guardarBeneficiario && !propia && !this.d.beneficiarios.some((b) => b.iban.replace(/\s/g, "") === ibanLimpio))
      this.d.beneficiarios.push({ id: `b-${this.seq++}`, nombre: p.beneficiario, iban: formatearIban(ibanLimpio), banco: "Otra entidad" });
    if (programada) {
      const op = this.registrar("transferencia_programada", `Transferencia programada a ${p.beneficiario} para el ${p.fecha}`, p.importe);
      op.estado = "pendiente";
      return { ok: true, estado: "programada", mensaje: `Transferencia de ${eur(p.importe)} a ${p.beneficiario} programada para el ${p.fecha}.`, operacion: op };
    }
    const mov = this.nuevoMovimiento({
      cuentaId: origen.id,
      concepto: `Transferencia${p.inmediata ? " inmediata" : ""} a ${p.beneficiario}${p.concepto ? ` · ${p.concepto}` : ""}`,
      comercio: p.beneficiario,
      categoria: propia ? "Ahorro" : "Transferencias",
      tipo: propia ? "traspaso" : "transferencia",
      importe: -r2(p.importe),
    });
    if (propia)
      this.nuevoMovimiento({ cuentaId: propia.id, concepto: `Traspaso desde ${origen.alias}`, comercio: origen.alias, categoria: "Ahorro", tipo: "traspaso", importe: r2(p.importe) });
    const op = this.registrar("transferencia", `Transferencia a ${p.beneficiario}`, p.importe);
    return {
      ok: true,
      estado: "completado",
      mensaje: `Transferencia de ${eur(p.importe)} a ${p.beneficiario} ${p.inmediata ? "realizada al instante" : "enviada (llegará el próximo día hábil)"}.`,
      operacion: op,
      movimiento: mov,
      saldoRestante: origen.saldo,
    };
  }

  actualizarTarjeta(id: string, cambios: Partial<Pick<Tarjeta, "bloqueada" | "comprasOnline" | "pagosExtranjero" | "contactless" | "limiteDiario" | "limiteCajero">>) {
    const t = this.d.tarjetas.find((x) => x.id === id);
    if (!t) throw new BankError("Tarjeta no encontrada");
    if (cambios.limiteCajero != null && (cambios.limiteCajero < 0 || cambios.limiteCajero > 1500)) throw new BankError("El límite de cajero debe estar entre 0 y 1.500 €.");
    if (cambios.limiteDiario != null && (cambios.limiteDiario < 100 || cambios.limiteDiario > 6000)) throw new BankError("El límite diario debe estar entre 100 y 6.000 €.");
    Object.assign(t, cambios);
    const desc = Object.entries(cambios)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    const op = this.registrar("tarjeta", `${t.alias}: ${desc}`);
    return { ok: true, tarjeta: t, operacion: op, mensaje: cambios.bloqueada === true ? `Tarjeta ${t.alias} bloqueada temporalmente.` : cambios.bloqueada === false ? `Tarjeta ${t.alias} desbloqueada.` : `Tarjeta ${t.alias} actualizada.` };
  }

  devolverRecibo(movimientoId: string, motivo?: string) {
    const mov = this.d.movimientos.find((m) => m.id === movimientoId);
    if (!mov || mov.tipo !== "recibo") throw new BankError("Solo se pueden devolver recibos domiciliados.");
    if (mov.estado === "devuelto") throw new BankError("Este recibo ya está devuelto.");
    const limite = iso(addDays(new Date(this.hoy), -56));
    if (mov.fecha < limite) throw new BankError("Han pasado más de 8 semanas: ya no se puede devolver este recibo.");
    mov.estado = "devuelto";
    const abono = this.nuevoMovimiento({
      cuentaId: mov.cuentaId,
      concepto: `Devolución ${mov.concepto}`,
      comercio: mov.comercio,
      categoria: mov.categoria,
      tipo: "recibo",
      importe: -mov.importe,
    });
    abono.estado = "devuelto";
    const rec = this.d.recibos.find((r) => r.id === mov.reciboId);
    const h = rec?.historico.find((x) => x.movimientoId === mov.id);
    if (h) h.estado = "devuelto";
    const op = this.registrar("devolucion_recibo", `Devolución recibo ${mov.comercio}${motivo ? ` (${motivo})` : ""}`, -mov.importe);
    return { ok: true, mensaje: `Recibo de ${mov.comercio} por ${eur(-mov.importe)} devuelto. El importe ya está en tu cuenta.`, operacion: op };
  }

  pagarPendiente(id: string, otp?: string) {
    this.verificarOtp(otp);
    const p = this.d.pagosPendientes.find((x) => x.id === id);
    if (!p) throw new BankError("Pago no encontrado");
    if (p.estado === "pagado") throw new BankError("Este pago ya está realizado.");
    const importe = p.descuento && p.descuento.hasta >= this.hoy ? p.descuento.importe : p.importe;
    const c = this.cuenta("cta-nomina");
    if (c.saldo < importe) throw new BankError("Saldo insuficiente.");
    this.nuevoMovimiento({ cuentaId: c.id, concepto: `Pago ${p.concepto} · Ref ${p.referencia}`, comercio: p.emisor, categoria: "Impuestos", tipo: "recibo", importe: -importe });
    p.estado = "pagado";
    const op = this.registrar("pago", `Pago ${p.concepto}`, importe);
    return { ok: true, mensaje: `Pago de ${eur(importe)} a ${p.emisor} realizado${importe < p.importe ? ` (te has ahorrado ${eur(p.importe - importe)})` : ""}.`, operacion: op };
  }

  aportarObjetivo(id: string, importe: number) {
    const o = this.d.objetivos.find((x) => x.id === id);
    if (!o) throw new BankError("Objetivo no encontrado");
    if (importe <= 0) throw new BankError("El importe debe ser positivo");
    const c = this.cuenta("cta-nomina");
    if (c.saldo < importe) throw new BankError("Saldo insuficiente en la Cuenta Nómina.");
    this.nuevoMovimiento({ cuentaId: c.id, concepto: `Aportación objetivo ${o.nombre}`, comercio: "Cuenta Ahorro", categoria: "Ahorro", tipo: "traspaso", importe: -importe });
    this.nuevoMovimiento({ cuentaId: "cta-ahorro", concepto: `Aportación objetivo ${o.nombre}`, comercio: "Cuenta Nómina", categoria: "Ahorro", tipo: "traspaso", importe });
    o.ahorrado = r2(o.ahorrado + importe);
    const op = this.registrar("objetivo", `Aportación a ${o.nombre}`, importe);
    return { ok: true, objetivo: o, mensaje: `Has aportado ${eur(importe)} a "${o.nombre}". Llevas ${eur(o.ahorrado)} de ${eur(o.meta)}.`, operacion: op };
  }

  crearObjetivo(p: { nombre: string; emoji?: string; meta: number; fechaObjetivo: string; aportacionMensual?: number }) {
    const o = { id: `obj-${this.seq++}`, nombre: p.nombre, emoji: p.emoji ?? "🎯", meta: p.meta, ahorrado: 0, fechaObjetivo: p.fechaObjetivo, aportacionMensual: p.aportacionMensual ?? 0 };
    this.d.objetivos.push(o);
    this.registrar("objetivo", `Nuevo objetivo ${o.nombre}`);
    return { ok: true, objetivo: o, mensaje: `Objetivo "${o.nombre}" creado.` };
  }

  solicitarProducto(productoId: string, detalle?: Record<string, unknown>, otp?: string) {
    this.verificarOtp(otp);
    const p = PRODUCTOS.find((x) => x.id === productoId);
    if (!p) throw new BankError("Producto no encontrado");
    const s = { id: this.ref("SOL"), productoId, nombre: p.nombre, fecha: this.hoy, estado: p.tipo === "hipoteca" ? "En estudio" : "Aprobada", detalle };
    this.solicitudes.push(s);
    if (p.tipo === "prestamo" && detalle?.importe) {
      const importe = Number(detalle.importe);
      this.nuevoMovimiento({ cuentaId: "cta-nomina", concepto: `Abono ${p.nombre}`, comercio: "Finora", categoria: "Otros ingresos", tipo: "transferencia", importe });
      this.d.prestamos.push({
        id: `pre-${this.seq++}`,
        tipo: "personal",
        nombre: p.nombre,
        importeInicial: importe,
        capitalPendiente: importe,
        cuota: Number(detalle.cuota ?? 0),
        tin: p.tin ?? 0,
        inicio: this.hoy,
        fin: iso(addMonths(new Date(this.hoy), Number(detalle.plazoMeses ?? 12))),
        proximaCuota: iso(addMonths(new Date(this.hoy), 1)),
      });
    }
    this.registrar("solicitud", `Solicitud ${p.nombre}`);
    return {
      ok: true,
      solicitud: s,
      mensaje:
        s.estado === "Aprobada"
          ? `¡Listo! ${p.nombre} contratado.${p.tipo === "prestamo" && detalle?.importe ? ` Ya tienes ${eur(Number(detalle.importe))} en tu Cuenta Nómina.` : ""}`
          : `Hemos recibido tu solicitud de ${p.nombre}. Tu gestor ${this.d.cliente.gestor.nombre} te llamará en 48 h.`,
    };
  }

  actualizarPerfil(cambios: { email?: string; telefono?: string; calle?: string; cp?: string; ciudad?: string; notificacionesPush?: boolean; extractosPapel?: boolean; alertasSaldo?: number }, otp?: string) {
    this.verificarOtp(otp);
    const c = this.d.cliente;
    if (cambios.email !== undefined) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cambios.email)) throw new BankError("Email no válido");
      c.email = cambios.email;
    }
    if (cambios.telefono !== undefined) {
      if (!/^\+?[\d\s]{9,15}$/.test(cambios.telefono)) throw new BankError("Teléfono no válido");
      c.telefono = cambios.telefono;
    }
    if (cambios.calle) c.direccion.calle = cambios.calle;
    if (cambios.cp) c.direccion.cp = cambios.cp;
    if (cambios.ciudad) c.direccion.ciudad = cambios.ciudad;
    if (cambios.notificacionesPush !== undefined) c.preferencias.notificacionesPush = cambios.notificacionesPush;
    if (cambios.extractosPapel !== undefined) c.preferencias.extractosPapel = cambios.extractosPapel;
    if (cambios.alertasSaldo !== undefined) c.preferencias.alertasSaldo = cambios.alertasSaldo;
    const op = this.registrar("perfil", `Datos personales actualizados (${Object.keys(cambios).join(", ")})`);
    return { ok: true, cliente: this.cliente(), mensaje: "Tus datos se han actualizado correctamente.", operacion: op };
  }

  crearConsulta(asunto: string, mensaje: string) {
    const c = { id: this.ref("CAS"), asunto, mensaje, fecha: new Date().toISOString(), estado: "Abierta" };
    this.consultas.unshift(c);
    this.registrar("consulta", `Consulta: ${asunto}`);
    return { ok: true, consulta: c, mensaje: `Consulta ${c.id} registrada. Te responderemos en menos de 24 h.` };
  }
}

export function validarIban(iban: string) {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  if (s.startsWith("ES") && s.length !== 24) return false;
  const re = s.slice(4) + s.slice(0, 4);
  const num = re.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let mod = 0;
  for (const ch of num) mod = (mod * 10 + Number(ch)) % 97;
  return mod === 1;
}

export function formatearIban(iban: string) {
  return iban
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export const bank = new Bank();
export { eur };
