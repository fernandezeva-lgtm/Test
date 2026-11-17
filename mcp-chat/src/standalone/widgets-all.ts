// Versión compartible: un único bundle con los 13 widgets. Cada iframe arranca el suyo
// según <html data-widget="…">, así el código del SDK se incluye una sola vez en la página.
const widgets: Record<string, () => Promise<unknown>> = {
  posicion: () => import("../widgets/posicion.ts"),
  movimientos: () => import("../widgets/movimientos.ts"),
  analisis: () => import("../widgets/analisis.ts"),
  bizum: () => import("../widgets/bizum.ts"),
  transferencia: () => import("../widgets/transferencia.ts"),
  tarjetas: () => import("../widgets/tarjetas.ts"),
  recibos: () => import("../widgets/recibos.ts"),
  catalogo: () => import("../widgets/catalogo.ts"),
  simulador: () => import("../widgets/simulador.ts"),
  ayuda: () => import("../widgets/ayuda.ts"),
  perfil: () => import("../widgets/perfil.ts"),
  objetivos: () => import("../widgets/objetivos.ts"),
  inversiones: () => import("../widgets/inversiones.ts"),
};
widgets[document.documentElement.dataset.widget ?? ""]?.();
