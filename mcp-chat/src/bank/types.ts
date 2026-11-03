// Modelo de datos del banco simulado "Finora".

export type Categoria =
  | "Nómina"
  | "Otros ingresos"
  | "Vivienda"
  | "Suministros"
  | "Supermercado"
  | "Restaurantes"
  | "Transporte"
  | "Compras"
  | "Ocio"
  | "Suscripciones"
  | "Salud"
  | "Viajes"
  | "Seguros"
  | "Bizum"
  | "Transferencias"
  | "Ahorro"
  | "Efectivo"
  | "Impuestos"
  | "Intereses";

export type TipoMovimiento =
  | "tarjeta"
  | "recibo"
  | "transferencia"
  | "bizum"
  | "nomina"
  | "cajero"
  | "interes"
  | "traspaso";

export interface Movimiento {
  id: string;
  fecha: string; // YYYY-MM-DD
  cuentaId: string;
  concepto: string;
  comercio: string;
  categoria: Categoria;
  tipo: TipoMovimiento;
  importe: number; // negativo = cargo
  saldo: number; // saldo de la cuenta tras el movimiento
  tarjetaId?: string;
  reciboId?: string;
  estado: "completado" | "pendiente" | "devuelto";
  ubicacion?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  apellidos: string;
  dni: string;
  fechaNacimiento: string;
  email: string;
  telefono: string;
  direccion: { calle: string; cp: string; ciudad: string; provincia: string };
  profesion: string;
  segmento: string;
  clienteDesde: string;
  avatar: string;
  preferencias: { idioma: string; notificacionesPush: boolean; extractosPapel: boolean; alertasSaldo: number };
  gestor: { nombre: string; email: string; telefono: string; oficina: string; horario: string };
}

export interface Cuenta {
  id: string;
  alias: string;
  tipo: "corriente" | "ahorro";
  iban: string;
  saldo: number;
  saldoInicial: number;
  moneda: "EUR";
  titulares: string[];
  tae?: number;
  apertura: string;
}

export interface Tarjeta {
  id: string;
  alias: string;
  tipo: "debito" | "credito" | "virtual";
  red: "VISA" | "Mastercard";
  numero: string; // enmascarado
  titular: string;
  caducidad: string;
  cuentaId: string;
  color: string;
  bloqueada: boolean;
  comprasOnline: boolean;
  pagosExtranjero: boolean;
  contactless: boolean;
  limiteDiario: number;
  limiteCajero: number;
  limiteCredito?: number;
  dispuesto?: number;
}

export interface Prestamo {
  id: string;
  tipo: "hipoteca" | "personal";
  nombre: string;
  importeInicial: number;
  capitalPendiente: number;
  cuota: number;
  tin: number;
  inicio: string;
  fin: string;
  proximaCuota: string;
}

export interface Inversion {
  id: string;
  tipo: "fondo" | "plan_pensiones" | "deposito";
  nombre: string;
  isin?: string;
  participaciones?: number;
  valor: number;
  aportado: number;
  riesgo: number; // 1..7
  historico: { fecha: string; valor: number }[];
}

export interface Seguro {
  id: string;
  nombre: string;
  tipo: "hogar" | "vida" | "coche" | "salud";
  prima: number;
  periodicidad: "mensual" | "anual";
  renovacion: string;
  cobertura: string;
}

export interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
  avatar: string;
  frecuente: boolean;
}

export interface Beneficiario {
  id: string;
  nombre: string;
  iban: string;
  banco: string;
  alias?: string;
}

export interface Recibo {
  id: string;
  emisor: string;
  categoria: Categoria;
  periodicidad: "mensual" | "bimestral" | "trimestral" | "anual";
  ultimoImporte: number;
  importeMedio: number;
  proximoCargo: string;
  cuentaId: string;
  historico: { fecha: string; importe: number; movimientoId: string; estado: "completado" | "devuelto" }[];
  alerta?: string;
}

export interface PagoPendiente {
  id: string;
  concepto: string;
  emisor: string;
  importe: number;
  vencimiento: string;
  referencia: string;
  descuento?: { importe: number; hasta: string; motivo: string };
  estado: "pendiente" | "pagado";
}

export interface Objetivo {
  id: string;
  nombre: string;
  emoji: string;
  meta: number;
  ahorrado: number;
  fechaObjetivo: string;
  aportacionMensual: number;
}

export interface Producto {
  id: string;
  tipo: "cuenta" | "tarjeta" | "prestamo" | "hipoteca" | "inversion" | "seguro" | "deposito";
  nombre: string;
  resumen: string;
  ventajas: string[];
  condiciones: Record<string, string>;
  badge?: "Nuevo" | "Más popular" | "Recomendado para ti" | "Oferta";
  icono: string;
  color: string;
  tin?: number;
  tae?: number;
  contratado?: boolean;
}

export interface Faq {
  id: string;
  categoria: string;
  pregunta: string;
  respuesta: string;
  etiquetas: string[];
}

export interface Operacion {
  id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  importe?: number;
  estado: "completada" | "pendiente" | "rechazada";
  referencia: string;
}
