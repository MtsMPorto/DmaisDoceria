// Limite do aviso "últimas unidades" na LOJA. DUPLICAÇÃO registrada: o valor oficial é
// settings.low_stock_threshold (o painel lê de GET /api/admin/settings; a rota pública não o expõe).
export const LOW_STOCK_THRESHOLD = 10;

// PROVISÓRIO: chaves do localStorage usadas SOMENTE pelo módulo de orçamentos (escondido por
// SHOW_QUOTES). Produtos, clientes e vendas do painel vêm da API.
export const CUSTOMERS_KEY = "dmais_customers";
export const SALES_KEY = "dmais_sales";
export const QUOTES_KEY = "dmais_quotes";

// Chaves do sessionStorage (sessão do admin).
export const ADMIN_SESSION_KEY = "dmais_admin_session";
export const ADMIN_TOKEN_KEY = "dmais_admin_token";
