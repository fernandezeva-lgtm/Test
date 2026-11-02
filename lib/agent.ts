import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getSnapshot, spendingByCategory, totals, type FinancialSnapshot } from "./finance";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type Tool = Anthropic.Beta.Messages.BetaTool;
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;
type ToolUse = Anthropic.Beta.Messages.BetaToolUseBlock;

export const MODEL = "claude-opus-5-5";
const MAX_ITERATIONS = 8;

const client = new Anthropic();

const SYSTEM = `Eres "Finn", el asistente financiero personal de la app Mis Finanzas. Hablas en español de España, con un tono cercano, claro y profesional.

Tienes acceso, mediante herramientas, a las cuentas bancarias que el usuario ha agregado (saldos y movimientos). Úsalas siempre que la pregunta dependa de sus datos: no inventes cifras ni supongas movimientos. Si una herramienta no devuelve datos suficientes, dilo y sugiere qué podría hacer el usuario (por ejemplo, conectar otro banco).

Convenciones de los datos:
- Importes en euros. En los movimientos, negativo = gasto y positivo = ingreso.
- En las cuentas, un saldo negativo es una deuda (tarjeta de crédito o préstamo).
- Los traspasos entre cuentas propias (categoría "Ahorro") no son gasto real.

Cómo responder:
- Ve al grano: primero la respuesta, después el detalle relevante.
- Formatea los importes como 1.234,56 €.
- Usa listas o tablas Markdown cortas cuando ayuden a comparar.
- Puedes dar ideas de ahorro y presupuesto prácticas y basadas en sus datos. No recomiendes productos de inversión concretos; para decisiones complejas (fiscalidad, hipotecas, inversiones) sugiere consultar a un profesional.`;

const TOOLS: Tool[] = [
  {
    name: "listar_cuentas",
    description:
      "Devuelve todas las cuentas agregadas del usuario (banco, tipo, saldo), el patrimonio neto y las categorías de movimientos disponibles. Úsala para preguntas sobre saldos o para orientarte antes de buscar movimientos.",
    input_schema: { type: "object", properties: {} },
    eager_input_streaming: true,
  },
  {
    name: "buscar_movimientos",
    description:
      "Busca movimientos bancarios con filtros opcionales y devuelve la lista (ordenada del más reciente al más antiguo) junto con el número total y la suma de los resultados.",
    input_schema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Fecha inicial incluida, YYYY-MM-DD" },
        hasta: { type: "string", description: "Fecha final incluida, YYYY-MM-DD" },
        categoria: { type: "string", description: "Categoría exacta, p. ej. 'Supermercado'" },
        texto: { type: "string", description: "Texto a buscar en la descripción (sin distinguir mayúsculas)" },
        cuenta_id: { type: "string", description: "Id de una cuenta concreta" },
        tipo: { type: "string", enum: ["gasto", "ingreso"] },
        limite: { type: "integer", description: "Máximo de movimientos a devolver (por defecto 50, máximo 200)" },
      },
    },
    eager_input_streaming: true,
  },
  {
    name: "resumen_por_periodo",
    description:
      "Agrega importes de un periodo por categoría, por mes o por comercio. Ideal para preguntas como '¿en qué gasto más?' o '¿cómo evolucionan mis gastos?'. Excluye traspasos entre cuentas propias.",
    input_schema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Fecha inicial incluida, YYYY-MM-DD" },
        hasta: { type: "string", description: "Fecha final incluida, YYYY-MM-DD" },
        agrupar_por: { type: "string", enum: ["categoria", "mes", "comercio"] },
        tipo: { type: "string", enum: ["gasto", "ingreso"], description: "Por defecto 'gasto'" },
      },
      required: ["desde", "agrupar_por"],
    },
    eager_input_streaming: true,
  },
];

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SearchInput = z.object({
  desde: date.optional(),
  hasta: date.optional(),
  categoria: z.string().optional(),
  texto: z.string().optional(),
  cuenta_id: z.string().optional(),
  tipo: z.enum(["gasto", "ingreso"]).optional(),
  limite: z.number().int().positive().max(200).optional(),
});
const SummaryInput = z.object({
  desde: date,
  hasta: date.optional(),
  agrupar_por: z.enum(["categoria", "mes", "comercio"]),
  tipo: z.enum(["gasto", "ingreso"]).optional(),
});

const r2 = (n: number) => Math.round(n * 100) / 100;
const isTransfer = (c: string) => c === "Ahorro" || c.startsWith("Transferencias");

function runTool(name: string, input: unknown, snap: FinancialSnapshot): { content: string; isError?: boolean } {
  switch (name) {
    case "listar_cuentas": {
      const t = totals(snap.accounts);
      return {
        content: JSON.stringify({
          cuentas: snap.accounts.map((a) => ({
            id: a.id, banco: a.bankName, nombre: a.name, tipo: a.type, saldo: r2(a.balance), moneda: a.currency,
          })),
          patrimonio: { activos: r2(t.assets), deudas: r2(t.debts), neto: r2(t.net) },
          categorias_disponibles: [...new Set(snap.transactions.map((x) => x.category))].sort(),
          primer_movimiento: snap.transactions.at(-1)?.date ?? null,
          bancos_con_error: snap.errors.map((e) => e.bankName),
        }),
      };
    }
    case "buscar_movimientos": {
      const p = SearchInput.safeParse(input);
      if (!p.success) return { content: `Parámetros inválidos: ${p.error.message}`, isError: true };
      const f = p.data;
      const text = f.texto?.toLowerCase();
      const cat = f.categoria?.toLowerCase();
      const matches = snap.transactions.filter(
        (t) =>
          (!f.desde || t.date >= f.desde) &&
          (!f.hasta || t.date <= f.hasta) &&
          (!cat || t.category.toLowerCase() === cat) &&
          (!text || t.description.toLowerCase().includes(text)) &&
          (!f.cuenta_id || t.accountId === f.cuenta_id) &&
          (!f.tipo || (f.tipo === "gasto" ? t.amount < 0 : t.amount > 0)),
      );
      const accName = new Map(snap.accounts.map((a) => [a.id, `${a.bankName} · ${a.name}`]));
      return {
        content: JSON.stringify({
          total_resultados: matches.length,
          suma: r2(matches.reduce((s, t) => s + t.amount, 0)),
          movimientos: matches.slice(0, f.limite ?? 50).map((t) => ({
            fecha: t.date, descripcion: t.description, importe: t.amount, categoria: t.category, cuenta: accName.get(t.accountId),
          })),
        }),
      };
    }
    case "resumen_por_periodo": {
      const p = SummaryInput.safeParse(input);
      if (!p.success) return { content: `Parámetros inválidos: ${p.error.message}`, isError: true };
      const { desde, hasta, agrupar_por, tipo = "gasto" } = p.data;
      if (agrupar_por === "categoria" && tipo === "gasto") {
        return { content: JSON.stringify({ grupos: spendingByCategory(snap.transactions, desde, hasta).map((g) => ({ ...g, total: r2(g.total) })) }) };
      }
      const groups = new Map<string, { total: number; n: number }>();
      for (const t of snap.transactions) {
        if (t.date < desde || (hasta && t.date > hasta) || isTransfer(t.category)) continue;
        if (tipo === "gasto" ? t.amount >= 0 : t.amount <= 0) continue;
        const k = agrupar_por === "mes" ? t.date.slice(0, 7) : agrupar_por === "comercio" ? t.description : t.category;
        const g = groups.get(k) ?? { total: 0, n: 0 };
        g.total += Math.abs(t.amount);
        g.n++;
        groups.set(k, g);
      }
      const rows = [...groups.entries()].map(([grupo, g]) => ({ grupo, total: r2(g.total), movimientos: g.n }));
      rows.sort(agrupar_por === "mes" ? (a, b) => a.grupo.localeCompare(b.grupo) : (a, b) => b.total - a.total);
      return { content: JSON.stringify({ tipo, grupos: rows.slice(0, 40) }) };
    }
    default:
      return { content: `Herramienta desconocida: ${name}`, isError: true };
  }
}

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "error"; message: string }
  | { type: "done"; history: MessageParam[] };

/**
 * Ejecuta un turno del agente: añade el mensaje del usuario al historial,
 * llama a Claude en bucle mientras pida herramientas y emite eventos.
 * El historial devuelto incluye los bloques completos de cada respuesta
 * (sin modificar) para reenviarlos en el siguiente turno.
 */
export async function runAgentTurn(
  userId: string,
  history: MessageParam[],
  userMessage: string,
  emit: (e: AgentEvent) => void,
) {
  const messages: MessageParam[] = [...history, { role: "user", content: userMessage }];
  let snap: FinancialSnapshot | null = null;
  const today = new Date().toISOString().slice(0, 10);
  let jsonRetries = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Fecha de hoy: ${today}.` },
      ],
      tools: TOOLS,
      messages,
    });
    stream.on("text", (delta) => emit({ type: "text", delta }));

    let message: Anthropic.Beta.Messages.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Solo reintentamos entradas de herramienta que no se pudieron parsear.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue;
    }

    if (message.stop_reason === "refusal") {
      emit({ type: "text", delta: "\n\nLo siento, no puedo ayudarte con esa petición." });
      break;
    }

    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b): b is ToolUse => b.type === "tool_use");
    if (toolUses.length === 0) break;
    if (message.stop_reason === "max_tokens") {
      emit({ type: "error", message: "La respuesta se ha cortado. Prueba con una pregunta más concreta." });
      messages.pop();
      break;
    }

    snap ??= await getSnapshot(userId);
    const results: ToolResult[] = toolUses.map((tu) => {
      emit({ type: "tool", name: tu.name });
      const { content, isError } = runTool(tu.name, tu.input, snap!);
      return { type: "tool_result", tool_use_id: tu.id, content, is_error: isError };
    });
    messages.push({ role: "user", content: results });

    if (i === MAX_ITERATIONS - 1) {
      emit({ type: "error", message: "He alcanzado el límite de pasos para esta pregunta." });
    }
  }

  emit({ type: "done", history: messages });
}
