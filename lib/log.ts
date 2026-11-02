import "server-only";

/**
 * Resume un error para el log SIN credenciales.
 * Los errores de Plaid son AxiosError: incluyen `config.headers` (PLAID-SECRET)
 * y `config.data` (access_token / public_token). Nunca se deben registrar enteros.
 */
export function safeError(err: unknown) {
  const e = err as {
    isAxiosError?: boolean;
    message?: string;
    response?: { status?: number; data?: { error_code?: string; error_type?: string; request_id?: string } };
  };
  if (e?.isAxiosError) {
    return {
      status: e.response?.status,
      error_code: e.response?.data?.error_code,
      error_type: e.response?.data?.error_type,
      request_id: e.response?.data?.request_id,
    };
  }
  return { message: e?.message ?? String(err) };
}

export function logError(context: string, err: unknown) {
  console.error(context, safeError(err));
}
