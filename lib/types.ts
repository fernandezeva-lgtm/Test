export type AccountType = "corriente" | "ahorro" | "tarjeta" | "inversion" | "prestamo" | "otro";

export type Account = {
  id: string;
  connectionId: string;
  bankId: string;
  bankName: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  mask?: string | null;
};

export type Transaction = {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  description: string;
  /** Negativo = gasto, positivo = ingreso. */
  amount: number;
  category: string;
  currency: string;
};

export type Connection = {
  id: string;
  bankId: string;
  bankName: string;
  provider: "plaid" | "demo";
  createdAt: string;
  /** Token de acceso de Plaid cifrado (solo provider = plaid). */
  accessTokenEnc?: string;
};
