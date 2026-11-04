// Generador determinista de 2 años de datos bancarios realistas para la clienta demo.
import type {
  Beneficiario,
  Categoria,
  Cliente,
  Contacto,
  Cuenta,
  Inversion,
  Movimiento,
  Objetivo,
  PagoPendiente,
  Prestamo,
  Recibo,
  Seguro,
  Tarjeta,
  TipoMovimiento,
} from "./types.ts";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
export const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface BankData {
  hoy: string;
  cliente: Cliente;
  cuentas: Cuenta[];
  tarjetas: Tarjeta[];
  prestamos: Prestamo[];
  inversiones: Inversion[];
  seguros: Seguro[];
  contactos: Contacto[];
  beneficiarios: Beneficiario[];
  movimientos: Movimiento[];
  recibos: Recibo[];
  pagosPendientes: PagoPendiente[];
  objetivos: Objetivo[];
}

export function generarDatos(hoyDate = new Date()): BankData {
  const rnd = mulberry32(20241103);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const hoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate());
  const inicio = addDays(hoy, -730);

  const cliente: Cliente = {
    id: "CLI-0042",
    nombre: "Lucía",
    apellidos: "Martín Ortega",
    dni: "12345678Z",
    fechaNacimiento: "1989-04-17",
    email: "lucia.martin@correo.example",
    telefono: "+34 612 345 678",
    direccion: { calle: "Calle del Olivo 14, 3ºB", cp: "28015", ciudad: "Madrid", provincia: "Madrid" },
    profesion: "Ingeniera de software",
    segmento: "Personal Premium",
    clienteDesde: "2014-09-02",
    avatar: "LM",
    preferencias: { idioma: "es", notificacionesPush: true, extractosPapel: false, alertasSaldo: 300 },
    gestor: {
      nombre: "Carlos Ruiz Vega",
      email: "carlos.ruiz@finora.example",
      telefono: "+34 910 000 123",
      oficina: "Oficina 0217 · Chamberí, Madrid",
      horario: "L-V 8:30 a 17:30",
    },
  };

  const cuentas: Cuenta[] = [
    {
      id: "cta-nomina",
      alias: "Cuenta Nómina",
      tipo: "corriente",
      iban: "ES91 2100 0418 4502 0005 1332",
      saldo: 0,
      saldoInicial: 0,
      moneda: "EUR",
      titulares: ["Lucía Martín Ortega"],
      apertura: "2014-09-02",
    },
    {
      id: "cta-ahorro",
      alias: "Cuenta Ahorro",
      tipo: "ahorro",
      iban: "ES52 2100 0418 4802 0012 7741",
      saldo: 0,
      saldoInicial: 0,
      moneda: "EUR",
      titulares: ["Lucía Martín Ortega"],
      tae: 1.5,
      apertura: "2019-03-11",
    },
  ];

  const tarjetas: Tarjeta[] = [
    {
      id: "tj-debito",
      alias: "Débito Esencial",
      tipo: "debito",
      red: "VISA",
      numero: "•••• •••• •••• 4821",
      titular: "LUCIA MARTIN ORTEGA",
      caducidad: "08/28",
      cuentaId: "cta-nomina",
      color: "linear-gradient(135deg,#00668e 0%,#0099d8 100%)",
      bloqueada: false,
      comprasOnline: true,
      pagosExtranjero: false,
      contactless: true,
      limiteDiario: 1500,
      limiteCajero: 600,
    },
    {
      id: "tj-credito",
      alias: "Crédito Oro",
      tipo: "credito",
      red: "Mastercard",
      numero: "•••• •••• •••• 7390",
      titular: "LUCIA MARTIN ORTEGA",
      caducidad: "03/27",
      cuentaId: "cta-nomina",
      color: "linear-gradient(135deg,#050608 0%,#1e2329 60%,#2b3138 100%)",
      bloqueada: false,
      comprasOnline: true,
      pagosExtranjero: true,
      contactless: true,
      limiteDiario: 2500,
      limiteCajero: 300,
      limiteCredito: 4000,
      dispuesto: 0,
    },
    {
      id: "tj-virtual",
      alias: "Virtual Compras Online",
      tipo: "virtual",
      red: "VISA",
      numero: "•••• •••• •••• 1157",
      titular: "LUCIA MARTIN ORTEGA",
      caducidad: "11/27",
      cuentaId: "cta-nomina",
      color: "linear-gradient(135deg,#002f43 0%,#007eae 100%)",
      bloqueada: false,
      comprasOnline: true,
      pagosExtranjero: true,
      contactless: false,
      limiteDiario: 600,
      limiteCajero: 0,
    },
  ];

  const contactos: Contacto[] = [
    { id: "c-marta", nombre: "Marta Gómez", telefono: "+34 600 111 222", avatar: "MG", frecuente: true },
    { id: "c-javi", nombre: "Javier López", telefono: "+34 600 333 444", avatar: "JL", frecuente: true },
    { id: "c-ana", nombre: "Ana Martín (hermana)", telefono: "+34 600 555 666", avatar: "AM", frecuente: true },
    { id: "c-pablo", nombre: "Pablo Sánchez", telefono: "+34 600 777 888", avatar: "PS", frecuente: false },
    { id: "c-lucas", nombre: "Lucas Fernández", telefono: "+34 611 222 333", avatar: "LF", frecuente: false },
    { id: "c-irene", nombre: "Irene Navarro", telefono: "+34 622 444 555", avatar: "IN", frecuente: true },
    { id: "c-mama", nombre: "Mamá", telefono: "+34 633 666 777", avatar: "♥", frecuente: true },
    { id: "c-dani", nombre: "Dani (pádel)", telefono: "+34 644 888 999", avatar: "DP", frecuente: false },
  ];

  const beneficiarios: Beneficiario[] = [
    { id: "b-casero", nombre: "Comunidad Prop. Calle Olivo 14", iban: "ES44 2100 0418 4502 0005 1111", banco: "Finora", alias: "Comunidad" },
    { id: "b-ana", nombre: "Ana Martín Ortega", iban: "ES79 2100 0813 6101 2345 6789", banco: "Finora", alias: "Hermana" },
    { id: "b-academia", nombre: "Academia de Idiomas Babel S.L.", iban: "ES18 0182 4000 6102 0158 4321", banco: "Banco Ejemplo", alias: "Inglés" },
    { id: "b-fontanero", nombre: "Reformas Hogar Pérez", iban: "ES17 0049 1500 0512 3456 7890", banco: "Banco Demo" },
  ];

  const movs: Omit<Movimiento, "saldo" | "id">[] = [];
  const add = (
    fecha: Date,
    cuentaId: string,
    concepto: string,
    comercio: string,
    categoria: Categoria,
    tipo: TipoMovimiento,
    importe: number,
    extra: Partial<Movimiento> = {},
  ) => {
    if (fecha > hoy) return;
    movs.push({ fecha: iso(fecha), cuentaId, concepto, comercio, categoria, tipo, importe: r2(importe), estado: "completado", ...extra });
  };

  const supers = ["Mercadona", "Carrefour", "Lidl", "Ahorramas", "Dia", "Alcampo"];
  const restaurantes = [
    "La Tasquita de Enfrente",
    "Sushi Kiro",
    "Pizzería Nápoles",
    "Café Comercial",
    "Burger Joint",
    "Taberna El Sur",
    "Glovo",
    "Just Eat",
    "Bar Casa Paco",
    "Ramen Shifu",
  ];
  const compras = ["Amazon", "Zara", "El Corte Inglés", "IKEA", "Decathlon", "MediaMarkt", "Primark", "Fnac", "Uniqlo"];
  const ocio = ["Cines Yelmo", "Teatro Kapital", "Steam", "Ticketmaster", "Bowling Chamartín", "Museo del Prado", "Escape Room Enigma"];
  const transporte = ["Repsol", "Cepsa", "Cabify", "Uber", "Renfe", "Metro de Madrid", "BiciMAD", "Parking Plaza Mayor"];
  const ubic = ["Madrid", "Madrid", "Madrid", "Madrid", "Alcobendas", "Pozuelo"];

  // Recibos domiciliados (se registran para construir la vista de recibos).
  const recibosDef: {
    id: string;
    emisor: string;
    categoria: Categoria;
    periodicidad: Recibo["periodicidad"];
    dia: number;
    meses?: number[]; // meses (0-11) en los que se cobra
    importe: (d: Date) => number;
    desde?: Date;
    hasta?: Date;
  }[] = [
    { id: "rec-hipoteca", emisor: "Préstamo hipotecario Finora", categoria: "Vivienda", periodicidad: "mensual", dia: 1, importe: () => 689.42 },
    { id: "rec-comunidad", emisor: "Comunidad Prop. Calle Olivo 14", categoria: "Vivienda", periodicidad: "mensual", dia: 3, importe: () => 85 },
    {
      id: "rec-luz",
      emisor: "Eléctrica Solar Ibérica",
      categoria: "Suministros",
      periodicidad: "mensual",
      dia: 7,
      importe: (d) => {
        const m = d.getMonth();
        const invierno = m === 11 || m <= 1 ? 32 : m === 6 || m === 7 ? 22 : 0;
        // Pico anómalo el mes pasado para generar una alerta.
        const anomalo = iso(addMonths(hoy, -1)).slice(0, 7) === iso(d).slice(0, 7) ? 58 : 0;
        return 48 + invierno + between(-6, 9) + anomalo;
      },
    },
    { id: "rec-gas", emisor: "GasHogar Natural", categoria: "Suministros", periodicidad: "bimestral", dia: 12, meses: [0, 2, 4, 6, 8, 10], importe: (d) => (d.getMonth() <= 2 || d.getMonth() >= 10 ? 78 : 34) + between(-5, 8) },
    { id: "rec-agua", emisor: "Canal de Aguas Municipal", categoria: "Suministros", periodicidad: "trimestral", dia: 15, meses: [1, 4, 7, 10], importe: () => 38 + between(-4, 6) },
    { id: "rec-telco", emisor: "Onda Fibra + Móvil", categoria: "Suministros", periodicidad: "mensual", dia: 5, importe: () => 52.9 },
    { id: "rec-gym", emisor: "Gimnasio FitUrban", categoria: "Salud", periodicidad: "mensual", dia: 10, importe: () => 39.9 },
    { id: "rec-netflix", emisor: "Netflix", categoria: "Suscripciones", periodicidad: "mensual", dia: 12, importe: (d) => (d < addMonths(hoy, -8) ? 13.99 : 15.99) },
    { id: "rec-spotify", emisor: "Spotify", categoria: "Suscripciones", periodicidad: "mensual", dia: 15, importe: (d) => (d < addMonths(hoy, -14) ? 10.99 : 11.99) },
    { id: "rec-icloud", emisor: "Apple iCloud+", categoria: "Suscripciones", periodicidad: "mensual", dia: 18, importe: () => 2.99 },
    { id: "rec-disney", emisor: "Disney+", categoria: "Suscripciones", periodicidad: "mensual", dia: 20, importe: () => 9.99, hasta: addMonths(hoy, -10) },
    { id: "rec-chatbot", emisor: "Suscripción IA Pro", categoria: "Suscripciones", periodicidad: "mensual", dia: 22, importe: () => 22, desde: addMonths(hoy, -5) },
    { id: "rec-seg-vida", emisor: "Finora Seguros · Vida", categoria: "Seguros", periodicidad: "mensual", dia: 2, importe: () => 18.5 },
    { id: "rec-seg-hogar", emisor: "Finora Seguros · Hogar", categoria: "Seguros", periodicidad: "anual", dia: 14, meses: [2], importe: () => 312.4 },
    { id: "rec-ibi", emisor: "Ayuntamiento · IBI", categoria: "Impuestos", periodicidad: "anual", dia: 1, meses: [9], importe: () => 421.37 },
  ];
  const recibosHist = new Map<string, { fecha: string; importe: number; idx: number }[]>();

  for (let d = new Date(inicio); d <= hoy; d = addDays(d, 1)) {
    const dia = d.getDate();
    const mes = d.getMonth();
    const dow = d.getDay();
    const ultimoDia = new Date(d.getFullYear(), mes + 1, 0).getDate();

    // Recibos
    for (const r of recibosDef) {
      if (dia !== r.dia) continue;
      if (r.meses && !r.meses.includes(mes)) continue;
      if (r.desde && d < r.desde) continue;
      if (r.hasta && d > r.hasta) continue;
      const imp = r2(r.importe(d));
      const concepto = r.id === "rec-hipoteca" ? "Cuota préstamo hipotecario" : `Recibo ${r.emisor}`;
      add(d, "cta-nomina", concepto, r.emisor, r.categoria, "recibo", -imp, { reciboId: r.id });
      const h = recibosHist.get(r.id) ?? [];
      h.push({ fecha: iso(d), importe: imp, idx: movs.length - 1 });
      recibosHist.set(r.id, h);
    }

    // Nómina (día 28) y pagas extra
    if (dia === 28) {
      const subida = d >= new Date(2025, 6, 1);
      const neto = subida ? 3045.18 : 2870.55;
      add(d, "cta-nomina", "Nómina · Tecnologías Atlas S.L.", "Tecnologías Atlas S.L.", "Nómina", "nomina", neto);
      if (mes === 5 || mes === 11) add(d, "cta-nomina", "Paga extra · Tecnologías Atlas S.L.", "Tecnologías Atlas S.L.", "Nómina", "nomina", neto * 0.92);
    }
    // Ahorro automático día 29
    if (dia === Math.min(29, ultimoDia)) {
      add(d, "cta-nomina", "Traspaso a Cuenta Ahorro", "Cuenta Ahorro", "Ahorro", "traspaso", -900);
      add(d, "cta-ahorro", "Traspaso desde Cuenta Nómina", "Cuenta Nómina", "Ahorro", "traspaso", 900);
    }
    // Intereses cuenta ahorro (último día)
    if (dia === ultimoDia) add(d, "cta-ahorro", "Liquidación de intereses", "Finora", "Intereses", "interes", between(14, 24));
    // Aportación fondo indexado día 6
    if (dia === 6) add(d, "cta-nomina", "Aportación periódica Fondo Indexado Global", "Finora Gestión", "Ahorro", "traspaso", -150);

    // Supermercado: martes y sábado aprox.
    if ((dow === 2 && rnd() < 0.7) || (dow === 6 && rnd() < 0.85)) {
      add(d, "cta-nomina", `Compra ${pick(supers)}`, pick(supers), "Supermercado", "tarjeta", -between(15, 92), {
        tarjetaId: "tj-debito",
        ubicacion: pick(ubic),
      });
    }
    // Restaurantes
    if (rnd() < (dow >= 5 ? 0.3 : 0.08)) {
      const c = pick(restaurantes);
      add(d, "cta-nomina", c, c, "Restaurantes", "tarjeta", -between(9, 68), {
        tarjetaId: rnd() < 0.6 ? "tj-debito" : "tj-credito",
        ubicacion: pick(ubic),
      });
    }
    // Transporte
    if (rnd() < 0.13) {
      const c = pick(transporte);
      const imp = c === "Repsol" || c === "Cepsa" ? between(42, 72) : c === "Renfe" ? between(12, 65) : between(3, 22);
      add(d, "cta-nomina", c, c, "Transporte", "tarjeta", -imp, { tarjetaId: "tj-debito", ubicacion: "Madrid" });
    }
    // Compras
    if (rnd() < 0.09) {
      const c = pick(compras);
      add(d, "cta-nomina", c === "Amazon" ? "AMZN Mktp ES" : c, c, "Compras", "tarjeta", -between(9, c === "IKEA" || c === "MediaMarkt" ? 260 : 95), {
        tarjetaId: c === "Amazon" ? "tj-virtual" : pick(["tj-debito", "tj-credito"]),
        ubicacion: c === "Amazon" ? "Online" : pick(ubic),
      });
    }
    // Ocio
    if (rnd() < 0.07) {
      const c = pick(ocio);
      add(d, "cta-nomina", c, c, "Ocio", "tarjeta", -between(8, 75), { tarjetaId: "tj-credito", ubicacion: c === "Steam" ? "Online" : "Madrid" });
    }
    // Salud (farmacia)
    if (rnd() < 0.04) add(d, "cta-nomina", "Farmacia Lda. Ortiz", "Farmacia Lda. Ortiz", "Salud", "tarjeta", -between(4, 38), { tarjetaId: "tj-debito", ubicacion: "Madrid" });
    // Cajero
    if (dia === 9 || (dia === 22 && rnd() < 0.4)) add(d, "cta-nomina", "Retirada cajero", "Cajero Finora", "Efectivo", "cajero", -pick([40, 50, 60, 100]), { tarjetaId: "tj-debito" });
    // Bizum enviados / recibidos
    if (rnd() < 0.1) {
      const c = pick(contactos);
      add(d, "cta-nomina", `Bizum a ${c.nombre}`, c.nombre, "Bizum", "bizum", -between(5, 45), { ubicacion: pick(["Cena", "Regalo", "Pádel", "Entradas", "Taxi", "Cumple"]) });
    }
    if (rnd() < 0.06) {
      const c = pick(contactos);
      add(d, "cta-nomina", `Bizum de ${c.nombre}`, c.nombre, "Bizum", "bizum", between(5, 40));
    }
    // Viajes: verano y navidad
    if ((mes === 7 && dia === 3) || (mes === 11 && dia === 20) || (mes === 3 && dia === 12)) {
      const destino = mes === 7 ? pick(["Lisboa", "Japón", "Menorca", "Italia"]) : mes === 11 ? "Asturias" : "Sevilla";
      add(d, "cta-nomina", `Vuelos · ${destino}`, pick(["Iberia", "Vueling", "Ryanair"]), "Viajes", "tarjeta", -between(120, mes === 7 ? 980 : 260), {
        tarjetaId: "tj-credito",
        ubicacion: "Online",
      });
      add(addDays(d, 2), "cta-nomina", `Hotel · ${destino}`, pick(["Booking.com", "Airbnb", "NH Hoteles"]), "Viajes", "tarjeta", -between(180, mes === 7 ? 1100 : 380), {
        tarjetaId: "tj-credito",
        ubicacion: destino,
      });
    }
    // Hacienda: devolución IRPF en junio
    if (mes === 5 && dia === 20) add(d, "cta-nomina", "Devolución IRPF · AEAT", "Agencia Tributaria", "Otros ingresos", "transferencia", between(280, 620));
    // Transferencia a academia de inglés (septiembre-junio)
    if (dia === 4 && (mes >= 8 || mes <= 5)) add(d, "cta-nomina", "Transferencia · Academia de Idiomas Babel", "Academia de Idiomas Babel S.L.", "Transferencias", "transferencia", -95);
    // Venta en Wallapop esporádica
    if (rnd() < 0.008) add(d, "cta-nomina", "Transferencia recibida · Wallapop", "Wallapop", "Otros ingresos", "transferencia", between(15, 180));
  }

  // Un movimiento pendiente de hoy y un cargo "sospechoso" reciente.
  add(hoy, "cta-nomina", "AMZN Mktp ES", "Amazon", "Compras", "tarjeta", -34.99, { tarjetaId: "tj-virtual", estado: "pendiente", ubicacion: "Online" });
  add(addDays(hoy, -2), "cta-nomina", "PAYPAL *DIGITALSRV 4029357733", "PayPal *DIGITALSRV", "Compras", "tarjeta", -49.99, {
    tarjetaId: "tj-credito",
    ubicacion: "Luxemburgo",
  });

  movs.sort((a, b) => (a.fecha === b.fecha ? 0 : a.fecha < b.fecha ? -1 : 1));

  // Saldos: fijamos el saldo final deseado y calculamos el inicial hacia atrás.
  const saldoInicial: Record<string, number> = { "cta-nomina": 2450.0, "cta-ahorro": 6200.0 };
  const movimientos: Movimiento[] = [];
  for (const c of cuentas) {
    const total = movs.filter((m) => m.cuentaId === c.id).reduce((s, m) => s + m.importe, 0);
    c.saldoInicial = saldoInicial[c.id];
    c.saldo = r2(saldoInicial[c.id] + total);
  }
  const run: Record<string, number> = Object.fromEntries(cuentas.map((c) => [c.id, c.saldoInicial]));
  movs.forEach((m, i) => {
    run[m.cuentaId] = r2(run[m.cuentaId] + m.importe);
    movimientos.push({ ...m, id: `MOV-${String(i + 1).padStart(5, "0")}`, saldo: run[m.cuentaId] });
  });

  // Recibos con su histórico
  const recibos: Recibo[] = recibosDef
    .filter((r) => recibosHist.has(r.id))
    .map((r) => {
      const h = recibosHist.get(r.id)!;
      const ultimo = h[h.length - 1];
      const medio = r2(h.reduce((s, x) => s + x.importe, 0) / h.length);
      const step = { mensual: 1, bimestral: 2, trimestral: 3, anual: 12 }[r.periodicidad];
      let prox = new Date(ultimo.fecha);
      prox = addMonths(prox, step);
      const activo = !r.hasta;
      let alerta: string | undefined;
      if (h.length >= 2 && ultimo.importe > h[h.length - 2].importe * 1.05 && r.periodicidad === "mensual") {
        const prev = h[h.length - 2].importe;
        alerta =
          r.categoria === "Suscripciones"
            ? `Subida de precio: de ${prev.toFixed(2)} € a ${ultimo.importe.toFixed(2)} €`
            : `Importe ${Math.round((ultimo.importe / medio - 1) * 100)}% superior a tu media`;
      }
      if (r.id === "rec-netflix" && !alerta) alerta = "Subió de 13,99 € a 15,99 € hace 8 meses";
      return {
        id: r.id,
        emisor: r.emisor,
        categoria: r.categoria,
        periodicidad: r.periodicidad,
        ultimoImporte: ultimo.importe,
        importeMedio: medio,
        proximoCargo: activo ? iso(prox) : "Cancelado",
        cuentaId: "cta-nomina",
        historico: h.map((x) => ({ fecha: x.fecha, importe: x.importe, movimientoId: movimientos[x.idx].id, estado: "completado" as const })),
        alerta,
      };
    });

  // Dispuesto de la tarjeta de crédito = compras del mes en curso con ella.
  const mesActual = iso(hoy).slice(0, 7);
  const credito = tarjetas.find((t) => t.id === "tj-credito")!;
  credito.dispuesto = r2(
    -movimientos.filter((m) => m.tarjetaId === "tj-credito" && m.fecha.startsWith(mesActual)).reduce((s, m) => s + m.importe, 0),
  );

  const prestamos: Prestamo[] = [
    {
      id: "pre-hipoteca",
      tipo: "hipoteca",
      nombre: "Hipoteca Fija Finora · Vivienda habitual",
      importeInicial: 180000,
      capitalPendiente: 141236.77,
      cuota: 689.42,
      tin: 1.95,
      inicio: "2019-05-01",
      fin: "2049-05-01",
      proximaCuota: iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)),
    },
  ];

  // Inversiones con histórico mensual (random walk con deriva)
  const histFondo = (inicial: number, deriva: number, vol: number, aport: number) => {
    const out: { fecha: string; valor: number }[] = [];
    let v = inicial;
    for (let i = 24; i >= 0; i--) {
      const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      if (i !== 24) v = v * (1 + deriva + (rnd() - 0.45) * vol) + aport;
      out.push({ fecha: iso(f), valor: r2(v) });
    }
    return out;
  };
  const hFondo = histFondo(8200, 0.006, 0.07, 150);
  const hPlan = histFondo(14100, 0.003, 0.03, 0);
  const inversiones: Inversion[] = [
    {
      id: "inv-indexado",
      tipo: "fondo",
      nombre: "Fondo Indexado Global",
      isin: "ES0000000042",
      participaciones: 812.44,
      valor: hFondo[hFondo.length - 1].valor,
      aportado: 8200 + 150 * 24,
      riesgo: 4,
      historico: hFondo,
    },
    {
      id: "inv-pensiones",
      tipo: "plan_pensiones",
      nombre: "Plan de Pensiones Futuro 2055",
      valor: hPlan[hPlan.length - 1].valor,
      aportado: 13500,
      riesgo: 3,
      historico: hPlan,
    },
  ];

  const seguros: Seguro[] = [
    { id: "seg-hogar", nombre: "Seguro Hogar Completo", tipo: "hogar", prima: 312.4, periodicidad: "anual", renovacion: `${hoy.getFullYear() + 1}-03-14`, cobertura: "Continente 180.000 € · Contenido 30.000 €" },
    { id: "seg-vida", nombre: "Seguro Vida Riesgo", tipo: "vida", prima: 18.5, periodicidad: "mensual", renovacion: `${hoy.getFullYear() + 1}-01-01`, cobertura: "Capital 150.000 € (vinculado a hipoteca)" },
  ];

  const pagosPendientes: PagoPendiente[] = [
    {
      id: "pp-ivtm",
      concepto: "Impuesto de vehículos (IVTM)",
      emisor: "Ayuntamiento de Madrid",
      importe: 98.4,
      vencimiento: iso(addDays(hoy, 12)),
      referencia: "IVTM-2026-118274",
      estado: "pendiente",
    },
    {
      id: "pp-multa",
      concepto: "Multa de tráfico · Velocidad",
      emisor: "Dirección General de Tráfico",
      importe: 100,
      vencimiento: iso(addDays(hoy, 25)),
      referencia: "DGT-28-5512093",
      descuento: { importe: 50, hasta: iso(addDays(hoy, 9)), motivo: "Pronto pago (50%)" },
      estado: "pendiente",
    },
    {
      id: "pp-dentista",
      concepto: "Factura revisión dental",
      emisor: "Clínica Dental Sonrisa",
      importe: 120,
      vencimiento: iso(addDays(hoy, 5)),
      referencia: "FAC-2026-0931",
      estado: "pendiente",
    },
  ];

  const objetivos: Objetivo[] = [
    { id: "obj-japon", nombre: "Viaje a Japón", emoji: "🗾", meta: 4500, ahorrado: 2860, fechaObjetivo: iso(addMonths(hoy, 7)), aportacionMensual: 250 },
    { id: "obj-emergencia", nombre: "Fondo de emergencia", emoji: "🛟", meta: 12000, ahorrado: 9400, fechaObjetivo: iso(addMonths(hoy, 10)), aportacionMensual: 300 },
    { id: "obj-coche", nombre: "Entrada coche eléctrico", emoji: "🔌", meta: 8000, ahorrado: 1950, fechaObjetivo: iso(addMonths(hoy, 20)), aportacionMensual: 200 },
  ];

  return {
    hoy: iso(hoy),
    cliente,
    cuentas,
    tarjetas,
    prestamos,
    inversiones,
    seguros,
    contactos,
    beneficiarios,
    movimientos,
    recibos,
    pagosPendientes,
    objetivos,
  };
}
