# Progresso da Fase 3

Estado: **Partes 1 a 8 concluídas no código.** O que depende de banco de testes ou de conferência manual no navegador está listado em "Não verificado".

## Feito

### Parte 1: banco
- Contagens (somente leitura) depois da limpeza: categories 6, settings 3, todo o resto 0 (incluindo admin_users). Bateu com o esperado.
- `prisma db pull`: sem diferenças estruturais em relação ao `schema.prisma` (só alinhamento de espaços; arquivo original mantido).
- Catálogo do Postgres comparado com `database/supabase/schema.sql`: 13 tabelas, 2 views e 19 triggers idênticos; 19 funções, com uma a mais no banco (`public.rls_auto_enable`, auxiliar padrão do Supabase). RLS ativa nas 13 tabelas.
- Seed executado: criou o primeiro administrador (username do `.env`; a senha não foi impressa).
- Baseline: `prisma/migrations/0_init/migration.sql` gerado com `migrate diff --from-empty --to-schema ... --script` (385 linhas, 13 `CREATE TABLE`) e marcado como aplicado com `migrate resolve --applied 0_init` (só grava em `_prisma_migrations`). `migrate status`: "Database schema is up to date". **Esse arquivo não tem triggers, RLS, funções nem views.**

### Parte 2: login, configurações, catálogo
- `GET /api/auth/me`; `requireAuth` confere admin ativo (uma consulta por request).
- `GET /api/settings` (só `whatsappNumber` e `companyName`), `GET /api/admin/settings` (+ `lowStockThreshold`).
- Categorias (público só ativas, em ordem; admin: listar, criar, editar, ativar/desativar).
- Produtos (público e por id sem custo; admin: listar com custo e inativos, criar com saldo inicial e sabores, PATCH estrito que rejeita `stock`, ativar/desativar, `POST :id/stock` com motivo via `adjust_stock`, sabores criar/editar/ativar).
- Frontend: `ProductsContext` e o painel usam a API; formulário sem "Estoque" na edição, saldo inicial no cadastro, "Ajustar estoque", descrição, categorias e sabores gerenciáveis; "Inativar" no lugar de excluir; "Resetar catálogo" removido; "Valor de venda do estoque".

### Parte 3: pedidos
- Checkout: `requestId` por pedido (reutilizado nas tentativas iguais), registra na API e só depois abre o WhatsApp; falha mostra erro e permite tentar de novo; mensagem montada com os dados oficiais devolvidos.
- Carrinho: abaixo do `minQty` bloqueia o envio; acima do estoque é só aviso.
- Validações do checkout alinhadas ao Zod/banco.
- Admin: pedido só cancela (REQUESTED → CANCELED); com venda confirmada/entregue o banco responde 409. Tela "Solicitações": listar com filtro, ver itens com sabores, cancelar, "Criar venda a partir do pedido".

### Parte 4: clientes
- Endpoints admin: listar com busca/filtros, criar, editar/inativar, histórico de vendas, estatísticas via `v_sales_summary`.
- Documento com dígito verificador (CNPJ numérico), único; telefone 10 a 15 dígitos; CEP 8; UF válida; `code` pelo banco. Nunca apagado.
- "Criar venda a partir do pedido": acha o cliente pelo documento, cria com os dados do pedido se não existir, 409 se o tipo for diferente ou o cliente estiver inativo.
- Frontend: `AdminCustomers` pela API; aba "Orçamentos" escondida por `SHOW_QUOTES`.

### Parte 5: vendas
- Rascunho, confirmar (`confirm_sale`), entregar, cancelar (`cancel_sale`); entregue não cancela (409).
- Itens só em rascunho (catálogo: inteiro, produto/sabor ativos, sabor obrigatório se houver; avulso: até 3 casas, sem estoque); desconto ≤ subtotal com erro claro; pagamento coerente (PENDING/PARTIAL/PAID).
- `created_by_id` do JWT.
- Frontend: aba "Vendas" com o fluxo, código `VEN-` do banco; `dmais_sales` removido do painel.

### Parte 6: relatórios
- `GET /api/admin/reports/summary` (período, produtos, período anterior, séries por dia/mês, ranking) e `sales.csv` (com neutralização de fórmulas).
- Faturamento = subtotal − desconto das entregues por `sale_date`; custo/lucro "indisponível" sem custo completo; recebido/pendente por `v_sales_summary`.
- Estatísticas do cliente: total com frete (rotulado), pendente do banco, favorito, última compra.
- KPIs de produtos no painel com o limite de `GET /api/admin/settings`.

### Parte 7: depoimentos, categorias, rodapé
- Depoimentos: público só publicados (a seção some se não houver); gestão no painel (criar, editar, publicar/despublicar, ordenar).
- Categorias gerenciadas no painel de produtos.
- Rodapé sem links `href="#"`; WhatsApp e nome da API.

### Parte 8: verificação
- Backend: `typecheck` OK; 110 testes unitários, 110 passam.
- Frontend: `tsc --noEmit` OK e `vite build` OK.
- `grep` de `localStorage`/`sessionStorage`: sobram o JWT (`sessionStorage`) e o módulo de orçamentos (provisório).
- `grep`: `cost` só no `adminSelect`; nenhuma escrita em `stock` fora do INSERT do saldo inicial, `adjust_stock`, `confirm_sale` e `cancel_sale`.
- Smoke test somente leitura contra a API real (token assinado localmente): todas as rotas GET respondem 200 e as validações 400/401 se comportam.

## Segurança do backend (informação pedida)
- `helmet` ativo (cabeçalhos de segurança padrão), `x-powered-by` desligado, JSON limitado a 100 kb.
- Login usa `failed_attempts`/`locked_until`: 5 senhas erradas bloqueiam a conta por 15 min; resposta igual para usuário inexistente, inativo, bloqueado ou senha errada; hash descartável para tempo constante.
- Rate limit em memória por IP: login 10/15 min, pedido 10/15 min, leituras públicas 600/15 min. **Correção feita:** o cabeçalho `Retry-After` estava dobrado (dividia por 500 em vez de 1000).
- Atenção: não há `trust proxy`. Atrás de proxy reverso/CDN, todos os visitantes compartilhariam o mesmo IP no limitador. Configurar `app.set("trust proxy", n)` conforme a hospedagem.
- Limitador em memória não é compartilhado entre instâncias.

## Conflitos entre este prompt e o banco
- **Cancelar pedido com venda confirmada:** o banco recusa; a API devolve 409 (mapeado).
- **Pedido CONFIRMED manual:** o banco permite, mas a API só aceita CANCELED; a confirmação ocorre via venda (regra do prompt e da decisão 3).
- **Saldo inicial:** o trigger `audit_stock` classifica INSERT sem `dmais.sale_id` como `OPENING`; a transação define `dmais.admin_id` e `dmais.stock_reason`, então o movimento sai com o autor correto.
- Seguido o banco em todos os casos.

## Não verificado
- **Testes de integração escritos e NÃO executados** (sem `DATABASE_URL_TEST`): `backend/tests/integration/catalog-and-sales.integration.test.ts` (saldo inicial OPENING com autor, PATCH rejeitando `stock`, `adjust_stock`, custo fora da rota pública, pedido oficial/idempotente/mínimo/estoque, venda a partir do pedido, confirmar/cancelar com estoque, entregue não cancela, relatório, cliente duplicado 409, admin inativo 401). O setup recusa rodar se `DATABASE_URL_TEST` faltar ou for igual a `DATABASE_URL`.
- **Escritas contra o banco não foram exercitadas** (somente leituras): criação de produto/saldo inicial, ajuste de estoque, pedido, venda, confirmação/cancelamento. O comportamento dos erros de trigger no COMMIT (constraint triggers diferidos) via Prisma foi verificado no código instalado, não em execução.
- **Navegador:** fluxo visual completo do checkout (incluindo o bloqueio de pop-up do WhatsApp), painel em telas pequenas, tabelas longas e o fluxo de vendas.
- Aba "Orçamentos" (código preservado, escondido): não testada.

## Pendente
- Confirmação do titular sobre descartar dados do `localStorage`.
- Banco de testes para a integração.
- Destino dos orçamentos; evolução do armazenamento do JWT.
