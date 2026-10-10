const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Limitador por IP, em memória (ver shared/middlewares/rateLimit.ts).
export const ORDER_CREATE_LIMIT = { windowMs: FIFTEEN_MINUTES, max: 10 };
export const LOGIN_LIMIT = { windowMs: FIFTEEN_MINUTES, max: 10 };
// Leituras públicas da loja (catálogo, categorias, configurações, depoimentos).
export const PUBLIC_READ_LIMIT = { windowMs: FIFTEEN_MINUTES, max: 600 };

// Bloqueio da conta do admin após senhas erradas seguidas.
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCK_MS = FIFTEEN_MINUTES;
