import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { currentUserId } from "@/auth";
import { runAgentTurn, type AgentEvent } from "@/lib/agent";

export const maxDuration = 300;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  // Historial completo devuelto por el turno anterior (se reenvía sin cambios).
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.unknown() })).max(200),
});

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Falta ANTHROPIC_API_KEY en el servidor" }, { status: 500 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Petición inválida" }, { status: 400 });
  const { message, history } = parsed.data;

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgentTurn(userId, history as Anthropic.Beta.Messages.BetaMessageParam[], message, emit);
      } catch (err) {
        console.error("chat", err);
        let msg = "Ha ocurrido un error al contactar con el asistente.";
        if (err instanceof Anthropic.RateLimitError) msg = "Demasiadas peticiones. Espera unos segundos y vuelve a intentarlo.";
        else if (err instanceof Anthropic.AuthenticationError) msg = "La clave de la API de Claude no es válida.";
        else if (err instanceof Anthropic.BadRequestError) msg = "La conversación no es válida. Empieza una nueva.";
        else if (err instanceof Anthropic.APIConnectionError) msg = "No se pudo conectar con el asistente.";
        emit({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
