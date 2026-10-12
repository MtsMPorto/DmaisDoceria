import { API_URL } from "@/config/env";
import { ApiError } from "./api";

export const CUSTOMER_TOKEN_KEY = "dmais_customer_token";
export interface AccountProfile {
  id: number;
  type: "PF" | "PJ";
  name: string;
  tradeName: string | null;
  responsibleName: string | null;
  document: string | null;
  phone: string;
  email: string;
  zip: string;
  street: string;
  streetNumber: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
}
export async function accountRequest<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const token = sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Tente novamente.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 401 &&
      data.error?.code === "CUSTOMER_UNAUTHORIZED"
    ) {
      sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
      window.dispatchEvent(new Event("customer-session-ended"));
    }
    throw new ApiError(
      response.status,
      data.error?.code || "HTTP_ERROR",
      data.error?.message || "Não foi possível concluir. Tente novamente.",
      data.error?.details,
    );
  }
  return data;
}
