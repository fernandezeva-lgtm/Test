import type { Account, Connection, Transaction } from "./types";

/**
 * Generador de datos de demostración deterministas, para poder usar la app
 * sin credenciales de Plaid. Mismo banco + misma conexión => mismos datos.
 */

function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

type Template = { description: string; category: string; min: number; max: number; perMonth: number };

const SPENDING: Template[] = [
  { description: "Mercadona", category: "Supermercado", min: 18, max: 95, perMonth: 6 },
  { description: "Carrefour", category: "Supermercado", min: 12, max: 70, perMonth: 2 },
  { description: "Lidl", category: "Supermercado", min: 10, max: 45, perMonth: 2 },
  { description: "Repsol", category: "Transporte", min: 40, max: 75, perMonth: 2 },
  { description: "Renfe", category: "Transporte", min: 8, max: 60, perMonth: 1 },
  { description: "Cabify", category: "Transporte", min: 9, max: 28, perMonth: 1 },
  { description: "Netflix", category: "Suscripciones", min: 13.99, max: 13.99, perMonth: 1 },
  { description: "Spotify", category: "Suscripciones", min: 11.99, max: 11.99, perMonth: 1 },
  { description: "Amazon", category: "Compras", min: 9, max: 120, perMonth: 3 },
  { description: "Zara", category: "Compras", min: 25, max: 110, perMonth: 1 },
  { description: "Restaurante La Tagliatella", category: "Restaurantes", min: 22, max: 68, perMonth: 2 },
  { description: "Bar Casa Paco", category: "Restaurantes", min: 6, max: 30, perMonth: 4 },
  { description: "Glovo", category: "Restaurantes", min: 14, max: 35, perMonth: 2 },
  { description: "Farmacia", category: "Salud", min: 5, max: 40, perMonth: 1 },
  { description: "Iberdrola", category: "Vivienda y suministros", min: 45, max: 95, perMonth: 1 },
  { description: "Movistar Fibra + Móvil", category: "Vivienda y suministros", min: 62, max: 62, perMonth: 1 },
  { description: "Canal de Isabel II", category: "Vivienda y suministros", min: 25, max: 40, perMonth: 0.5 },
  { description: "Gimnasio Basic-Fit", category: "Ocio", min: 29.99, max: 29.99, perMonth: 1 },
  { description: "Cines Yelmo", category: "Ocio", min: 9, max: 24, perMonth: 1 },
];

const round = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function demoData(conn: Connection): { accounts: Account[]; transactions: Transaction[] } {
  const r = rng(`${conn.id}:${conn.bankId}`);
  const base = { connectionId: conn.id, bankId: conn.bankId, bankName: conn.bankName, currency: "EUR" };
  const mask = () => String(Math.floor(1000 + r() * 9000));

  const checking: Account = {
    ...base,
    id: `${conn.id}-cc`,
    name: "Cuenta Corriente",
    type: "corriente",
    balance: round(1200 + r() * 4500),
    mask: mask(),
  };
  const accounts: Account[] = [checking];
  if (r() > 0.35) {
    accounts.push({ ...base, id: `${conn.id}-ah`, name: "Cuenta Ahorro", type: "ahorro", balance: round(3000 + r() * 18000), mask: mask() });
  }
  const card: Account = { ...base, id: `${conn.id}-tj`, name: "Tarjeta de Crédito", type: "tarjeta", balance: round(-(80 + r() * 900)), mask: mask() };
  accounts.push(card);

  const transactions: Transaction[] = [];
  let n = 0;
  const push = (accountId: string, date: Date, description: string, amount: number, category: string) =>
    transactions.push({ id: `${conn.id}-t${n++}`, accountId, date: iso(date), description, amount: round(amount), category, currency: "EUR" });

  const today = new Date();
  const salary = round(1800 + r() * 1400);
  const rent = round(650 + r() * 500);

  for (let m = 0; m < 6; m++) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const day = (d: number) => new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(d, daysInMonth), 12);
    const valid = (d: Date) => d <= today;

    const payday = day(28);
    if (valid(payday)) push(checking.id, payday, "Nómina - Empresa S.L.", salary, "Ingresos");
    const rentDay = day(1);
    if (valid(rentDay)) push(checking.id, rentDay, "Alquiler vivienda", -rent, "Vivienda y suministros");

    for (const t of SPENDING) {
      const fixed = t.min === t.max;
      const count = fixed ? 1 : t.perMonth < 1 ? (r() < t.perMonth ? 1 : 0) : Math.max(0, Math.round(t.perMonth + (r() - 0.5) * 2));
      for (let i = 0; i < count; i++) {
        const date = day(1 + Math.floor(r() * daysInMonth));
        if (!valid(date)) continue;
        const amount = t.min + r() * (t.max - t.min);
        const acc = ["Compras", "Restaurantes", "Ocio"].includes(t.category) && r() > 0.4 ? card.id : checking.id;
        push(acc, date, t.description, -amount, t.category);
      }
    }
    if (accounts.length > 2) {
      const sav = day(29);
      if (valid(sav)) {
        push(checking.id, sav, "Traspaso a Cuenta Ahorro", -200, "Ahorro");
        push(accounts[1].id, sav, "Traspaso desde Cuenta Corriente", 200, "Ahorro");
      }
    }
  }

  transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { accounts, transactions };
}
