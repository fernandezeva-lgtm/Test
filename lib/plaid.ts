import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function isPlaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

let client: PlaidApi | null = null;

export function plaid(): PlaidApi {
  if (!isPlaidConfigured()) throw new Error("Plaid no está configurado");
  if (!client) {
    const env = process.env.PLAID_ENV === "production" ? "production" : "sandbox";
    client = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[env],
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
            "PLAID-SECRET": process.env.PLAID_SECRET!,
          },
        },
      }),
    );
  }
  return client;
}

/** Traduce la categoría primaria de Plaid (personal_finance_category) al español. */
const CATEGORY_ES: Record<string, string> = {
  INCOME: "Ingresos",
  TRANSFER_IN: "Transferencias recibidas",
  TRANSFER_OUT: "Transferencias enviadas",
  LOAN_PAYMENTS: "Préstamos",
  BANK_FEES: "Comisiones",
  ENTERTAINMENT: "Ocio",
  FOOD_AND_DRINK: "Restaurantes",
  GENERAL_MERCHANDISE: "Compras",
  HOME_IMPROVEMENT: "Hogar",
  MEDICAL: "Salud",
  PERSONAL_CARE: "Cuidado personal",
  GENERAL_SERVICES: "Servicios",
  GOVERNMENT_AND_NON_PROFIT: "Impuestos y ONG",
  TRANSPORTATION: "Transporte",
  TRAVEL: "Viajes",
  RENT_AND_UTILITIES: "Vivienda y suministros",
};

export function translateCategory(primary: string | null | undefined): string {
  if (!primary) return "Otros";
  return CATEGORY_ES[primary] ?? "Otros";
}
