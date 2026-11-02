import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/auth";
import { getBank } from "@/lib/banks";
import { isPlaidConfigured, plaid } from "@/lib/plaid";
import { logError } from "@/lib/log";
import { addConnection, decrypt, listConnections, removeConnection, tokenAad } from "@/lib/store";

/** Crea una conexión de demostración (solo cuando Plaid no está configurado). */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (isPlaidConfigured()) return NextResponse.json({ error: "Usa Plaid Link para conectar" }, { status: 400 });

  const body = z.object({ bankId: z.string() }).safeParse(await req.json().catch(() => null));
  const bank = body.success ? getBank(body.data.bankId) : undefined;
  if (!bank) return NextResponse.json({ error: "Banco no válido" }, { status: 400 });

  const existing = await listConnections(userId);
  if (existing.some((c) => c.bankId === bank.id)) {
    return NextResponse.json({ error: `${bank.name} ya está conectado` }, { status: 409 });
  }
  const conn = await addConnection(userId, {
    id: crypto.randomUUID(),
    bankId: bank.id,
    bankName: bank.name,
    provider: "demo",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ connection: { id: conn.id, bankId: conn.bankId, bankName: conn.bankName } });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const removed = await removeConnection(userId, id);
  if (removed?.provider === "plaid" && removed.accessTokenEnc && isPlaidConfigured()) {
    // Revoca el acceso en Plaid; si falla, la conexión local ya está eliminada.
    try {
      await plaid().itemRemove({ access_token: decrypt(removed.accessTokenEnc, tokenAad(userId, removed.id)) });
    } catch (err) {
      logError("itemRemove", err);
    }
  }
  return NextResponse.json({ ok: Boolean(removed) });
}
