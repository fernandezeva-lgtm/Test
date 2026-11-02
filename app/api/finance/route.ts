import { NextResponse } from "next/server";
import { currentUserId } from "@/auth";
import { getSnapshot, spendingByCategory, totals } from "@/lib/finance";

const isTransfer = (c: string) => c === "Ahorro" || c.startsWith("Transferencias");

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const snap = await getSnapshot(userId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("sv-SE");
  let income = 0;
  let spending = 0;
  for (const t of snap.transactions) {
    if (t.date < monthStart || isTransfer(t.category)) continue;
    if (t.amount > 0) income += t.amount;
    else spending -= t.amount;
  }

  return NextResponse.json({
    connections: snap.connections.map(({ accessTokenEnc: _omit, ...c }) => c),
    accounts: snap.accounts,
    transactions: snap.transactions.slice(0, 25),
    errors: snap.errors,
    summary: {
      ...totals(snap.accounts),
      month: { income, spending },
      categories: spendingByCategory(snap.transactions, monthStart).slice(0, 6),
    },
  });
}
