# Arquitetura

Monorepo com dois aplicativos independentes, `frontend/` e `backend/`, o SQL do banco em `database/` e a documentação em `docs/`.

```
SiteDoceria/
├─ database/supabase/  schema.sql (cópia do que está no Supabase; fonte da verdade do banco)
├─ docs/               Guidelines.md, ARQUITETURA.md (este), DECISOES-FASE-3.md, AUDITORIA-FRONTEND-BANCO.md, PROGRESSO-FASE-3.md
├─ frontend/           React 18 + Vite 6 + Tailwind 4
└─ backend/            Express 5 + Prisma 7 + PostgreSQL (Supabase)
```

## Princípios

- **O banco é a autoridade das regras.** Triggers e funções do `schema.sql` validam produto ativo, mínimo, estoque, soma dos sabores, totais, transições de pedido e de venda. O código só traduz os erros (`mapDatabaseError`: 409/422).
- **O estoque nunca é alterado por UPDATE direto.** Saldo inicial: INSERT do produto dentro de uma transação que informa o administrador (`set_config('dmais.admin_id', ...)`). Ajustes: `public.adjust_stock`. Baixa e estorno: `public.confirm_sale` e `public.cancel_sale`.
- **O id do administrador vem sempre do JWT** (`res.locals.adminId`), nunca do corpo da requisição. `requireAuth` confere no banco se o administrador está ativo.
- **Nada é apagado.** Produtos, sabores, categorias e clientes são inativados (produtos também ganham `deleted_at`). Vendas são canceladas. Só existe DELETE para remover item de venda em rascunho.
- **Dinheiro trafega como texto** `"12.50"` (`numeric(10,2)`), sem ponto flutuante.
- **Custo (`products.cost`) nunca sai em rota pública.**

## Backend (`backend/`)

Organizado por **módulo**: rotas, controller, schema (Zod), serviço, repositório e, quando há regra pura, `*.rules.ts`/`*.math.ts`.

```
backend/
├─ prisma/
│  ├─ schema.prisma        modelos (gerado por `prisma db pull`, com nomes em camelCase via @map)
│  ├─ seed.ts              só o primeiro admin (ADMIN_* do .env)
│  └─ migrations/0_init/   baseline: SÓ registro (não recria triggers, RLS, funções nem views)
├─ prisma.config.ts
├─ tests/
│  ├─ modules, shared/     testes unitários (sem banco)  -> npm test
│  └─ integration/         escrevem no banco: só com DATABASE_URL_TEST -> npm run test:integration
└─ src/
   ├─ app.ts, server.ts
   ├─ config/              env, prisma, limites
   ├─ shared/              middlewares (auth, errorHandler, rateLimit), utils (errors, money, params, document, databaseErrors)
   └─ modules/
      auth        POST /api/auth/login · GET /api/auth/me
      settings    GET /api/settings (só whatsappNumber e companyName) · GET /api/admin/settings (+ lowStockThreshold)
      categories  GET /api/categories · /api/admin/categories (listar, criar, editar, ativar/desativar)
      products    GET /api/products(/:id) público, sem custo · /api/admin/products (CRUD com inativação,
                  POST :id/stock via adjust_stock, sabores: POST :id/flavors, PATCH :id/flavors/:flavorId)
      orders      POST /api/orders (público, idempotente por requestId, devolve dados oficiais)
                  GET /api/orders, GET /api/orders/:id, PATCH /api/orders/:id/status (só CANCELED)
      customers   /api/admin/customers (listar com busca, criar, editar/inativar, :id/sales)
      sales       /api/admin/sales (listar, criar rascunho, from-order/:orderId, editar, confirm, cancel, deliver, itens)
      reports     GET /api/admin/reports/summary · GET /api/admin/reports/sales.csv
      testimonials GET /api/testimonials (publicados) · /api/admin/testimonials (listar, criar, editar/publicar)
```

Fluxo de venda: `DRAFT` -> `confirm` (baixa estoque no banco) -> `deliver`. Confirmada pode ser cancelada (estorno único); entregue não cancela. Itens e valores só mudam em rascunho.

Erros: `{ "error": { "code", "message", "details"? } }`. Erros de regra do banco chegam como 409 (conflito de estado/único/restrição) ou 422 (regra violada).

Segurança: `helmet`, CORS por lista, JSON limitado a 100 kb, rate limit em memória por IP (login 10/15 min; pedidos 10/15 min; leituras públicas 600/15 min), bloqueio da conta após 5 senhas erradas (`failed_attempts`/`locked_until`, 15 min).

Variáveis de ambiente: ver `backend/.env.example`. Comandos: `npm run dev | build | start | typecheck | test | test:integration | prisma:generate | db:seed`. **Nunca** `migrate dev`, `db push` ou `migrate reset` (ver `database/README.md`).

## Frontend (`frontend/`)

```
frontend/src/
├─ main.tsx, App.tsx, routes.ts      (loader do painel confirma o token em GET /api/auth/me)
├─ services/       api.ts (fetch + Bearer + 401), authService.ts, endpoints.ts (todas as chamadas)
├─ hooks/          useAsync (carregando/erro/recarregar), useCheckoutForm
├─ contexts/       ProductsContext (catálogo, categorias, configurações e depoimentos da API), CartContext (memória)
├─ types/          api.ts (formatos da API) e tipos legados do módulo de orçamentos
├─ lib/            format, money, dates, document, cart, whatsapp, + quotes/customers/storage (orçamentos, provisório)
├─ components/     ui/, store/, admin/{products,customers,sales,reports,quotes}
└─ pages/          store/, admin/{products,orders,customers,sales,reports,testimonials,quotes}
```

Toda tela que usa a API mostra carregamento, erro e "Tentar de novo". 401 em rota autenticada derruba a sessão e volta ao login.

## Onde os dados ficam

| Dado | Onde |
|---|---|
| Produtos, categorias, sabores, estoque, configurações públicas, depoimentos | Banco (API) |
| Pedidos da loja (solicitações) | Banco (`POST /api/orders` antes de abrir o WhatsApp) |
| Clientes, vendas, relatórios | Banco (API do painel) |
| Login do admin | JWT em `sessionStorage` (risco registrado em `docs/DECISOES-FASE-3.md`) |
| Carrinho | Memória (perde-se ao recarregar) |
| **Orçamentos** | **`localStorage` (PROVISÓRIO, aba escondida por `SHOW_QUOTES = false`)** |

## Próximos passos

1. Rodar os testes de integração em um projeto Supabase de testes (`DATABASE_URL_TEST`).
2. Definir o destino do módulo de orçamentos (banco ou remoção).
3. Decidir a evolução do armazenamento do JWT (cookie `HttpOnly` + proteção CSRF).
