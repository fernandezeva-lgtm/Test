"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Check, Loader2, Lock, X } from "lucide-react";
import { BANKS, type Bank } from "@/lib/banks";
import { BankAvatar } from "./BankAvatar";

type Props = {
  open: boolean;
  connectedBankIds: string[];
  onClose: () => void;
  onConnected: () => void;
};

export function ConnectBankModal({ open, connectedBankIds, onClose, onConnected }: Props) {
  const [loadingBank, setLoadingBank] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Bank | null>(null);

  const onSuccess = useCallback(
    async (publicToken: string | null, metadata: PlaidLinkOnSuccessMetadata) => {
      if (!publicToken) {
        setLinkToken(null);
        setLoadingBank(null);
        return setError("El banco no devolvió un token válido");
      }
      const res = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, bankId: selected?.id, institutionName: metadata.institution?.name }),
      });
      setLinkToken(null);
      setLoadingBank(null);
      if (!res.ok) return setError((await res.json()).error ?? "No se pudo conectar el banco");
      onConnected();
    },
    [selected, onConnected],
  );

  const { open: openLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      setLinkToken(null);
      setLoadingBank(null);
    },
  });

  // Abre Plaid Link en cuanto el token está listo.
  useEffect(() => {
    if (linkToken && ready) openLink();
  }, [linkToken, ready, openLink]);

  async function connect(bank: Bank) {
    setError(null);
    setSelected(bank);
    setLoadingBank(bank.id);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.demo) {
        // Sin credenciales de Plaid: conexión simulada con datos de ejemplo.
        const r = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankId: bank.id }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        setLoadingBank(null);
        onConnected();
      } else {
        setLinkToken(data.linkToken);
      }
    } catch (e) {
      setLoadingBank(null);
      setError(e instanceof Error && e.message ? e.message : "No se pudo conectar el banco");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="connect-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="connect-title" className="text-2xl font-extrabold tracking-tight">Conecta tu banco</h2>
            <p className="mt-1 text-sm text-muted">Elige tu entidad. Te redirigiremos a su acceso seguro.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BANKS.map((bank) => {
            const connected = connectedBankIds.includes(bank.id);
            const loading = loadingBank === bank.id;
            return (
              <button
                key={bank.id}
                disabled={connected || loadingBank !== null}
                onClick={() => connect(bank)}
                className="group relative flex items-center gap-3 rounded-2xl border border-black/[0.06] p-3.5 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <BankAvatar bankId={bank.id} />
                <span className="flex-1 text-sm font-semibold leading-tight">{bank.name}</span>
                {connected && <Check className="h-4 w-4 text-emerald-600" />}
                {loading && <Loader2 className="h-4 w-4 animate-spin text-brand-500" />}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 rounded-xl bg-coral/10 px-4 py-2.5 text-sm font-medium text-coral">{error}</p>}

        <p className="mt-6 flex items-center gap-2 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" />
          Conexión cifrada de solo lectura vía Plaid (PSD2). Nunca vemos ni guardamos tus claves bancarias.
        </p>
      </div>
    </div>
  );
}
