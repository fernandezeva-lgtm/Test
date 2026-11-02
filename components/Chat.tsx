"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, RotateCcw, Search, Sparkles, Wallet, PieChart } from "lucide-react";
import { LogoMark } from "./Logo";

type Bubble = { role: "user" | "assistant"; text: string; tools: string[]; error?: string };

const SUGGESTIONS = [
  "¿Cuál es mi saldo total ahora mismo?",
  "¿En qué categorías he gastado más este mes?",
  "Compara mis gastos de los últimos 3 meses",
  "¿Cuánto pago al mes en suscripciones?",
  "Dame 3 ideas para ahorrar 200 € al mes",
];

const TOOL_LABEL: Record<string, { label: string; icon: typeof Search }> = {
  listar_cuentas: { label: "Consultando tus cuentas", icon: Wallet },
  buscar_movimientos: { label: "Buscando movimientos", icon: Search },
  resumen_por_periodo: { label: "Analizando tus gastos", icon: PieChart },
};

const STORAGE_KEY = "mf-chat-v1";

export function Chat() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        setBubbles(s.bubbles ?? []);
        setHistory(s.history ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles]);

  function persist(b: Bubble[], h: unknown[]) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ bubbles: b, history: h }));
    } catch {}
  }

  function reset() {
    setBubbles([]);
    setHistory([]);
    persist([], []);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);

    const base: Bubble[] = [...bubbles, { role: "user", text: message, tools: [] }];
    let reply: Bubble = { role: "assistant", text: "", tools: [] };
    const update = (patch: Partial<Bubble>) => {
      reply = { ...reply, ...patch };
      setBubbles([...base, reply]);
    };
    update({});

    let newHistory = history;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No se pudo contactar con el asistente");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") update({ text: reply.text + ev.delta });
          else if (ev.type === "tool") update({ tools: [...reply.tools, ev.name] });
          else if (ev.type === "error") update({ error: ev.message });
          else if (ev.type === "done") newHistory = ev.history;
        }
      }
    } catch (e) {
      update({ error: e instanceof Error ? e.message : "Error inesperado" });
    } finally {
      setBusy(false);
      // Solo avanzamos el historial si el turno terminó correctamente.
      const finalBubbles = [...base, reply];
      if (newHistory !== history) setHistory(newHistory);
      persist(finalBubbles, newHistory);
    }
  }

  const empty = bubbles.length === 0;

  return (
    <div className="card mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
        <LogoMark className="h-9 w-9" />
        <div className="flex-1">
          <p className="font-bold leading-tight">Finn</p>
          <p className="text-xs text-muted">Tu asistente financiero · IA</p>
        </div>
        {!empty && (
          <button onClick={reset} className="btn-ghost" disabled={busy}>
            <RotateCcw className="h-4 w-4" /> Nueva conversación
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
        {empty && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50">
              <Sparkles className="h-8 w-8 text-brand-500" />
            </span>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">¿En qué te ayudo hoy?</h2>
            <p className="mt-2 max-w-md text-sm text-muted">
              Pregúntame por tus saldos, gastos o hábitos. Analizo los datos de las cuentas que has conectado.
            </p>
            <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {bubbles.map((b, i) =>
          b.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-brand-500 px-4 py-2.5 text-[15px] text-white">{b.text}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <LogoMark className="mt-0.5 h-8 w-8 shrink-0" />
              <div className="min-w-0 max-w-[85%] space-y-2">
                {[...new Set(b.tools)].map((t) => {
                  const meta = TOOL_LABEL[t] ?? { label: t, icon: Search };
                  const Icon = meta.icon;
                  return (
                    <span key={t} className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">
                      <Icon className="h-3.5 w-3.5 text-brand-500" /> {meta.label}
                    </span>
                  );
                })}
                {b.text ? (
                  <div className="prose-chat rounded-3xl rounded-tl-lg bg-surface px-4 py-2 text-[15px] text-ink/90">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      // Sin imágenes: una imagen con datos en la URL podría filtrarlos a un tercero.
                      disallowedElements={["img"]}
                      components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-600 underline">{children}</a> }}
                    >
                      {b.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  busy && i === bubbles.length - 1 && !b.error && (
                    <div className="typing inline-flex gap-1 rounded-3xl rounded-tl-lg bg-surface px-4 py-3.5">
                      <span className="h-2 w-2 rounded-full bg-brand-400" />
                      <span className="h-2 w-2 rounded-full bg-brand-400" />
                      <span className="h-2 w-2 rounded-full bg-brand-400" />
                    </div>
                  )
                )}
                {b.error && <p className="rounded-2xl bg-coral/10 px-4 py-2 text-sm font-medium text-coral">{b.error}</p>}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-black/5 p-4"
      >
        <div className="flex items-end gap-2 rounded-3xl bg-surface p-2 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-brand-300">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Escribe tu pregunta…"
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted"
          />
          <button type="submit" disabled={busy || !input.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40" aria-label="Enviar">
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">Finn puede equivocarse. No constituye asesoramiento financiero profesional.</p>
      </form>
    </div>
  );
}
