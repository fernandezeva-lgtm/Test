const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });

export function money(n: number, currency = "EUR") {
  return currency === "EUR" ? eur.format(n) : new Intl.NumberFormat("es-ES", { style: "currency", currency, useGrouping: "always" }).format(n);
}

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
