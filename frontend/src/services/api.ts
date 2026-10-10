import { ADMIN_SESSION_KEY, ADMIN_TOKEN_KEY } from "@/config/constants";
import { API_URL } from "@/config/env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const CONNECTION_ERROR_MESSAGE = "Não foi possível conectar ao servidor. Tente novamente.";

// Chamado quando uma rota autenticada devolve 401 (token ausente, expirado ou admin inativo).
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function clearSession(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Envia o Bearer do administrador e trata 401 derrubando a sessão. */
  auth?: boolean;
}

async function send(path: string, { method = "GET", body, auth = false }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", CONNECTION_ERROR_MESSAGE);
  }

  if (!response.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      payload = await response.json();
    } catch {
      // corpo vazio ou não JSON
    }
    const error = new ApiError(
      response.status,
      payload.error?.code ?? "HTTP_ERROR",
      payload.error?.message ?? CONNECTION_ERROR_MESSAGE,
      payload.error?.details,
    );
    if (auth && response.status === 401) {
      clearSession();
      unauthorizedHandler?.();
    }
    throw error;
  }
  return response;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  return (await response.json()) as T;
}

export async function apiText(path: string, options: RequestOptions = {}): Promise<string> {
  const response = await send(path, options);
  return response.text();
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : CONNECTION_ERROR_MESSAGE;
}
