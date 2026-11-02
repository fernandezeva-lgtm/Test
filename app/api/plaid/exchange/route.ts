import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/auth";
import { getBank, matchBankByName } from "@/lib/banks";
import { isPlaidConfigured, plaid } from "@/lib/plaid";
import { logError } from "@/lib/log";
import { addConnection, encrypt, tokenAad } from "@/lib/store";

const Body = z.object({
  publicToken: z.string().min(1),
  bankId: z.string().optional(),
  institutionName: z.string().max(120).nullish(),
});

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isPlaidConfigured()) return NextResponse.json({ error: "Plaid no configurado" }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  const { publicToken, bankId, institutionName } = parsed.data;

  try {
    const { data } = await plaid().itemPublicTokenExchange({ public_token: publicToken });
    // Preferimos la institución real que eligió el usuario en Plaid Link.
    const bank = matchBankByName(institutionName) ?? (bankId ? getBank(bankId) : undefined);
    const id = crypto.randomUUID();
    const conn = await addConnection(userId, {
      id,
      bankId: bank?.id ?? "otro",
      bankName: (institutionName || bank?.name || "Banco").slice(0, 80),
      provider: "plaid",
      createdAt: new Date().toISOString(),
      accessTokenEnc: encrypt(data.access_token, tokenAad(userId, id)),
    });
    return NextResponse.json({ connection: { id: conn.id, bankId: conn.bankId, bankName: conn.bankName } });
  } catch (err) {
    logError("itemPublicTokenExchange", err);
    return NextResponse.json({ error: "No se pudo completar la conexión" }, { status: 502 });
  }
}
