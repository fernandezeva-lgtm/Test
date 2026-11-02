"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, Sparkles, Trash2, Wallet } from "lucide-react";
import type { Account, Connection, Transaction } from "@/lib/types";
import { money, shortDate } from "@/lib/format";
import { BankAvatar } from "./BankAvatar";
import { ConnectBankModal } from "./ConnectBankModal";

type FinanceData = {
  connections: Omit<Connection, "accessTokenEnc">[];
  accounts: Account[];
  transactions: Transaction[];
  errors: { connectionId: string; bankName: string; message: string }[];
  summary: {
    assets: number;
    debts: number;
    net: number;
    month: { income: number; spending: number };
    categories: { category: string; total: number }[];
  };
};

const TYPE_LABEL: Record<Account["type"], string> = {
  corriente: "Cuenta corriente",
  ahorro: "Ahorro",
  tarjeta: "Tarjeta",
  inversion: "Inversión",
  prestamo: "Préstamo",
  otro: "Otra",
};

const BAR_COLORS = ["#007EAE", "#2AA7D6", "#6CC3E6", "#FFC72C", "#F59E0B", "#A9DCF0"];

export function Dashboard() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function disconnect(id: string, bankName: string) {
    if (!confirm(`¿Desconectar ${bankName}? Dejaremos de acceder a sus datos.`)) return;
    await fetch(`/api/connections?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  if (!data) return <Skeleton />;

  const hasConnections = data.connections.length > 0;
  const accountName = new Map(data.accounts.map((a) => [a.id, a]));
  const maxCat = Math.max(1, ...data.summary.categories.map((c) => c.total));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tu resumen</h1>
          <p className="mt-1 text-muted">
            {hasConnections ? `${data.accounts.length} cuentas en ${data.connections.length} bancos` : "Empieza conectando tu primer banco"}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus className="h-4 w-4" /> Añadir banco
        </button>
      </div>

      {data.errors.length > 0 && (
        <div className="rounded-2xl bg-star/20 px-4 py-3 text-sm font-medium text-ink">
          No hemos podido actualizar: {data.errors.map((e) => e.bankName).join(", ")}. Inténtalo más tarde.
        </div>
      )}

      {!hasConnections ? (
        <div className="hero-gradient relative overflow-hidden rounded-[2rem] p-10 text-white sm:p-14">
          <div className="max-w-lg">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Wallet className="h-7 w-7 text-star" />
            </span>
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Conecta tus cuentas en segundos</h2>
            <p className="mt-3 text-white/85">
              Agrega CaixaBank, Santander, BBVA y otros bancos para ver todo tu dinero en un único lugar y
              hablar con Finn sobre tus finanzas.
            </p>
            <button
              onClick={() => setModal(true)}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-brand-700 shadow-lg transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" /> Conectar mi primer banco
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="hero-gradient relative flex flex-col justify-between overflow-hidden rounded-[2rem] p-7 text-white lg:col-span-2">
              <p className="text-sm font-medium text-white/80">Patrimonio neto</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{money(data.summary.net)}</p>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Activos" value={money(data.summary.assets)} />
                <Stat label="Deudas" value={money(data.summary.debts)} />
                <Stat label="Ingresos (mes)" value={money(data.summary.month.income)} icon={<ArrowUpRight className="h-4 w-4 text-emerald-300" />} />
                <Stat label="Gastos (mes)" value={money(data.summary.month.spending)} icon={<ArrowDownRight className="h-4 w-4 text-star" />} />
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-bold">Gastos de este mes</h2>
              <div className="mt-5 space-y-4">
                {data.summary.categories.length === 0 && <p className="text-sm text-muted">Sin gastos registrados este mes.</p>}
                {data.summary.categories.map((c, i) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{c.category}</span>
                      <span className="font-semibold">{money(c.total)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full" style={{ width: `${(c.total / maxCat) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              {data.connections.map((conn) => {
                const accounts = data.accounts.filter((a) => a.connectionId === conn.id);
                const total = accounts.reduce((s, a) => s + a.balance, 0);
                return (
                  <div key={conn.id} className="card p-5">
                    <div className="flex items-center gap-3">
                      <BankAvatar bankId={conn.bankId} name={conn.bankName} />
                      <div className="flex-1">
                        <p className="font-bold">{conn.bankName}</p>
                        <p className="text-xs text-muted">{conn.provider === "demo" ? "Datos de demostración" : "Conectado vía Plaid"}</p>
                      </div>
                      <p className="font-extrabold">{money(total)}</p>
                      <button onClick={() => disconnect(conn.id, conn.bankName)} className="rounded-full p-2 text-muted transition hover:bg-coral/10 hover:text-coral" title="Desconectar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <ul className="mt-4 divide-y divide-black/5">
                      {accounts.map((a) => (
                        <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                          <span>
                            <span className="font-medium">{a.name}</span>
                            <span className="ml-2 text-muted">
                              {TYPE_LABEL[a.type]}{a.mask ? ` · ••${a.mask}` : ""}
                            </span>
                          </span>
                          <span className={`font-semibold ${a.balance < 0 ? "text-coral" : ""}`}>{money(a.balance, a.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              <Link href="/asistente" className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-star/25 text-brand-700">
                  <Sparkles className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">Pregúntale a Finn</span>
                  <span className="text-sm text-muted">“¿En qué estoy gastando más este mes?”</span>
                </span>
                <ArrowUpRight className="h-5 w-5 text-brand-500 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            <div className="card p-6">
              <h2 className="font-bold">Últimos movimientos</h2>
              <ul className="mt-3 divide-y divide-black/5">
                {data.transactions.slice(0, 12).map((t) => {
                  const acc = accountName.get(t.accountId);
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-3">
                      {acc && <BankAvatar bankId={acc.bankId} name={acc.bankName} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.description}</p>
                        <p className="text-xs text-muted">{t.category} · {shortDate(t.date)}</p>
                      </div>
                      <span className={`text-sm font-bold ${t.amount > 0 ? "text-emerald-600" : ""}`}>
                        {t.amount > 0 ? "+" : ""}{money(t.amount, t.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}

      <ConnectBankModal
        open={modal}
        connectedBankIds={data.connections.map((c) => c.bankId)}
        onClose={() => setModal(false)}
        onConnected={() => {
          setModal(false);
          load();
        }}
      />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/12 p-3.5 backdrop-blur" style={{ background: "rgba(255,255,255,0.12)" }}>
      <p className="flex items-center gap-1 text-xs font-medium text-white/75">{icon}{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-48 rounded-xl bg-black/5" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-56 rounded-[2rem] bg-black/5 lg:col-span-2" />
        <div className="h-56 rounded-[2rem] bg-black/5" />
      </div>
    </div>
  );
}
