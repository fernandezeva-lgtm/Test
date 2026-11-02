import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { currentUserId } from "@/auth";
import { logError } from "@/lib/log";
import { isPlaidConfigured, plaid } from "@/lib/plaid";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isPlaidConfigured()) return NextResponse.json({ demo: true });

  try {
    const { data } = await plaid().linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Mis Finanzas",
      products: [Products.Transactions],
      country_codes: [CountryCode.Es],
      language: "es",
    });
    return NextResponse.json({ linkToken: data.link_token });
  } catch (err) {
    logError("linkTokenCreate", err);
    return NextResponse.json({ error: "No se pudo iniciar la conexión con el banco" }, { status: 502 });
  }
}
