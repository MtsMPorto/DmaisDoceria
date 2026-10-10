# D'mais Comercial de Doces

Catálogo digital de doces com carrinho e atendimento pelo WhatsApp. A compra é finalizada com a empresa no WhatsApp: o site não processa pagamentos.

- Regras de negócio: [docs/Guidelines.md](docs/Guidelines.md)
- Arquitetura e estrutura de pastas: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)

## Como rodar

Frontend (`frontend/`):

```bash
cd frontend
cp .env.example .env     # VITE_API_URL
npm install
npm run dev
```

Backend (`backend/`). O banco (Supabase/PostgreSQL) é criado pelo `database/supabase/schema.sql`, executado no SQL Editor; o Prisma é só cliente e introspecção:

```bash
cd backend
cp .env.example .env     # preencha DATABASE_URL, JWT_SECRET e ADMIN_*
npm install
npx prisma generate     # gera o client a partir do schema.prisma
npm run db:seed          # cria só o primeiro admin (categorias já vêm do schema.sql)
npm run dev
```

**Nunca** rode `prisma migrate dev`, `prisma db push` ou `prisma migrate reset`: o banco tem triggers, RLS, funções e views que o Prisma não recria. Mudanças de estrutura são feitas em SQL e refletidas com `npx prisma db pull`.

Verificações: `npm run typecheck` nos dois projetos, `npm test` no backend (testes unitários, sem banco) e `npm run build` no frontend.

Testes de integração (`npm run test:integration` no backend) **escrevem no banco**: só rodam com `DATABASE_URL_TEST` apontando para um projeto Supabase de testes (com o `schema.sql` aplicado) e diferente de `DATABASE_URL`. Sem isso, são ignorados.

## O que o sistema faz hoje

- **Loja:** catálogo, categorias, configurações (WhatsApp) e depoimentos publicados vêm da API. O pedido é registrado na API e só então o WhatsApp abre com a mensagem montada com os dados oficiais.
- **Painel (`/admin`):** produtos (saldo inicial no cadastro; depois só "Ajustar estoque" com motivo), categorias, sabores, solicitações da loja, clientes, vendas (rascunho → confirmar → entregar; confirmada pode cancelar, entregue não), relatórios e depoimentos.
- **Orçamentos:** código mantido, aba escondida (`SHOW_QUOTES = false` em `frontend/src/config/features.ts`). É a única parte que ainda usa `localStorage`.

Veja [docs/DECISOES-FASE-3.md](docs/DECISOES-FASE-3.md) e [database/README.md](database/README.md).
