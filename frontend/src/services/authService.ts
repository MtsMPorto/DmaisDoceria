import { ADMIN_SESSION_KEY, ADMIN_TOKEN_KEY } from "@/config/constants";
import { API_URL } from "@/config/env";
import { api, clearSession } from "@/services/api";

export const INVALID_CREDENTIALS_MESSAGE = "Usuário ou senha incorretos.";
export const CONNECTION_ERROR_MESSAGE = "Não foi possível conectar ao servidor. Tente novamente.";

export class AuthError extends Error {}

export interface CurrentAdmin {
  id: number;
  name: string;
  username: string;
}

export async function login(username: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new AuthError(CONNECTION_ERROR_MESSAGE);
  }

  if (response.status === 401) throw new AuthError(INVALID_CREDENTIALS_MESSAGE);
  if (response.status === 429) throw new AuthError("Muitas tentativas. Aguarde alguns minutos.");
  if (!response.ok) throw new AuthError(CONNECTION_ERROR_MESSAGE);

  let token: unknown;
  try {
    ({ token } = await response.json());
  } catch {
    throw new AuthError(CONNECTION_ERROR_MESSAGE);
  }
  if (typeof token !== "string" || !token) throw new AuthError(CONNECTION_ERROR_MESSAGE);

  // Risco conhecido (docs/DECISOES-FASE-3.md): o JWT em sessionStorage é legível por scripts da
  // página. Mantido nesta fase.
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
}

export function logout(): void {
  clearSession();
}

// Só indica que existe um token guardado; quem confirma a sessão é o servidor (fetchMe).
export function hasStoredToken(): boolean {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) !== null;
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true" && hasStoredToken();
}

// Confirma o token no servidor. 401 derruba a sessão (api.ts).
export function fetchMe(): Promise<CurrentAdmin> {
  return api<CurrentAdmin>("/api/auth/me", { auth: true });
}
