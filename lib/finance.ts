import "server-only";
import { AccountType as PlaidAccountType, type AccountBase, type Transaction as PlaidTx } from "plaid";
import { demoData } from "./demo";
import { plaid, translateCategory } from "./plaid";
import { logError } from "./log";
import { decrypt, listConnections, tokenAad } from "./store";
import type { Account, AccountType, Connection, Transaction } from "./types";

export type FinancialSnapshot = {
  connections: Connection[];
  accounts: Account[];
  transactions: Transaction[];
  errors: { connectionId: string; bankName: string; message: string }[];
};

function mapType(a: AccountBase): AccountType {
  switch (a.type) {
    case PlaidAccountType.Depository:
      return a.subtype === "savings" ? "ahorro" : "corriente";
    case PlaidAccountType.Credit:
      return "tarjeta";
    case PlaidAccountType.Investment:
    case PlaidAccountType.Brokerage:
      return "inversion";
    case PlaidAccountType.Loan:
      return "prestamo";
    default:
      return "otro";
  }
}

async function plaidData(userId: string, conn: Connection): Promise<{ accounts: Account[]; transactions: Transaction[] }> {
  const access_token = decrypt(conn.accessTokenEnc!, tokenAad(userId, conn.id));
  const client = plaid();

  const { data: acc } = await client.accountsGet({ access_token });
  const accounts: Account[] = acc.accounts.map((a) => {
    const type = mapType(a);
    const raw = a.balances.current ?? a.balances.available ?? 0;
    return {
      id: a.account_id,
      connectionId: conn.id,
      bankId: conn.bankId,
      bankName: conn.bankName,
      name: a.official_name || a.name,
      type,
      // Las deudas (tarjeta, préstamo) se muestran en negativo.
      balance: type === "tarjeta" || type === "prestamo" ? -Math.abs(raw) : raw,
      currency: a.balances.iso_currency_code ?? "EUR",
      mask: a.mask,
    };
  });

  const added: PlaidTx[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const { data } = await client.transactionsSync({ access_token, cursor, count: 500 });
    added.push(...data.added);
    cursor = data.next_cursor;
    if (!data.has_more) break;
  }

  const transactions: Transaction[] = added.map((t) => ({
    id: t.transaction_id,
    accountId: t.account_id,
    date: t.date,
    description: t.merchant_name || t.name,
    // Plaid: positivo = sale dinero. Aquí: negativo = gasto.
    amount: -t.amount,
    category: translateCategory(t.personal_finance_category?.primary),
    currency: t.iso_currency_code ?? "EUR",
  }));

  return { accounts, transactions };
}

export async function getSnapshot(userId: string): Promise<FinancialSnapshot> {
  const connections = await listConnections(userId);
  const results = await Promise.allSettled(
    connections.map(async (c) => (c.provider === "demo" ? demoData(c) : plaidData(userId, c))),
  );

  const snapshot: FinancialSnapshot = { connections, accounts: [], transactions: [], errors: [] };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      snapshot.accounts.push(...r.value.accounts);
      snapshot.transactions.push(...r.value.transactions);
    } else {
      const c = connections[i];
      logError(`Error obteniendo datos de ${c.bankName}`, r.reason);
      snapshot.errors.push({ connectionId: c.id, bankName: c.bankName, message: "No se pudieron obtener los datos" });
    }
  });
  snapshot.transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
  return snapshot;
}

export function totals(accounts: Account[]) {
  let assets = 0;
  let debts = 0;
  for (const a of accounts) {
    if (a.balance >= 0) assets += a.balance;
    else debts += a.balance;
  }
  return { assets, debts, net: assets + debts };
}

export function spendingByCategory(transactions: Transaction[], from: string, to?: string) {
  const out = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0 || t.date < from || (to && t.date > to)) continue;
    if (t.category === "Ahorro" || t.category === "Transferencias enviadas") continue;
    out.set(t.category, (out.get(t.category) ?? 0) - t.amount);
  }
  return [...out.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}
