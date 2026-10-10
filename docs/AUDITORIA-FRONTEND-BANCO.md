# Auditoria: frontend x banco

Somente leitura. Compara o que o `frontend/src` guarda e consulta com as 13 tabelas de `database/supabase/schema.sql` e `backend/prisma/schema.prisma`. Nenhum arquivo do projeto foi alterado e o banco não foi tocado nesta auditoria.

> O enunciado da auditoria foi cortado no último item ("textos e dados fixos ... contato, WhatsApp, horários, endereço,"). A seção 6 cobre tudo que parece configuração no código; se havia outro item além dele, é preciso reenviar.

## 1. Resumo

**O banco já cobre o que o frontend guarda hoje.** Cada campo de produto, cliente, venda, depoimento e configuração encontrado tem coluna correspondente. A única entidade sem tabela é **orçamento**, por decisão de escopo.

Os problemas não são de tabela que falta, e sim de **regras do banco que o frontend atual viola** e de **conceitos que o frontend usa sem existir no banco**:

| # | Achado | Gravidade |
|---|---|---|
| 1 | O frontend deixa editar e apagar venda, mudar status livremente e apagar cliente (apagando as vendas junto). O banco bloqueia tudo isso (itens de venda confirmada imutáveis, sem DELETE, cliente referenciado não apaga). | Alta: muda o fluxo de tela. |
| 2 | Hoje a venda do frontend **não mexe em estoque**. No banco, confirmar venda baixa o saldo e pode falhar por saldo insuficiente. | Alta: comportamento novo. |
| 3 | "Mais vendidos" e "Promoções" da loja são derivados de `stars` (`stars === 5` e `stars < 5`). Não existe campo de destaque, promoção nem ranking de vendas no banco. | Média: precisa de decisão. |
| 4 | Não existe tela de **solicitações de pedido** (`orders`) no admin, nem a loja chama a API: o pedido só segue pelo WhatsApp. O backend de pedidos está pronto e sem consumidor. | Média. |
| 5 | Validações do frontend divergem do backend e do banco (vizinhança obrigatória no Zod, CPF/CNPJ com dígito verificador, UF válida, telefone 10 a 15 dígitos, mínimo e estoque no carrinho). | Média: causará 400/422 na integração. |
| 6 | Todo dado administrativo está em `localStorage`, com IDs UUID para clientes e vendas e inteiros para produtos. | Informativo: exige decisão de migração. |
| 7 | A loja precisa ler WhatsApp, nome da empresa e limite de estoque baixo, mas `settings` é privada (RLS). Falta um endpoint público (backend) ou uma view. | Média. |

## 2. Armazenamento no navegador

| Chave | Storage | Quem lê | Quem escreve | Formato |
|---|---|---|---|---|
| `dmais_products` | localStorage | `ProductsContext` (loja e admin) | `ProductsContext` (efeito a cada mudança) | `Product[]`. Se vazia, cai em `INITIAL_PRODUCTS` (9 produtos fixos em `data/initialProducts.ts`). |
| `dmais_customers` | localStorage | `AdminCustomers`, `AdminQuotes`, `AdminReports` | `AdminCustomers`, `AdminQuotes` (cadastro rápido de cliente) | `Customer[]`, ID `crypto.randomUUID()` |
| `dmais_sales` | localStorage | `AdminCustomers`, `AdminReports`, `AdminQuotes` | `AdminCustomers`, `AdminQuotes` (converter orçamento) | `Sale[]`, ID UUID, com os itens embutidos (JSON) |
| `dmais_quotes` | localStorage | `AdminQuotes` | `AdminQuotes` | `Quote[]` (fora do escopo do banco) |
| `dmais_admin_token` | sessionStorage | `authService` | `authService.login` | JWT do backend |
| `dmais_admin_session` | sessionStorage | `authService.isAuthenticated`, `AdminLogin` | `authService.login`/`logout` | `"true"` |
| (carrinho) | memória | `CartContext` | `CartContext` | `CartItem[]`, perde-se ao recarregar |

Observações:
- Vendas, clientes e orçamentos são regravados inteiros a cada alteração (`useEffect`/`saveLS`), então duas abas se sobrescrevem.
- `AdminQuotes` lê `dmais_sales` direto do `localStorage` ao converter orçamento (sem passar por estado compartilhado).
- `AdminReports` carrega vendas e clientes uma vez (`useState` inicial) e não atualiza.
- A "sessão" do admin é só um flag no `sessionStorage`; a rota `/admin` não valida o token. O backend valida o JWT nas rotas protegidas.

## 3. Entidades do frontend x tabelas

### 3.1 Produto (`types/product.ts`, `ProductFormModal`)

| Frontend | Banco | Observação |
|---|---|---|
| `id: number` | `products.id` (serial) | Os 9 produtos de exemplo do banco parecem ter IDs 1 a 9, a confirmar contra `INITIAL_PRODUCTS`. |
| `name`, `brand` | `name`, `brand` | OK. O formulário só exige nome e marca (`saveAdd`). |
| `price` | `price numeric(10,2) >= 0` | OK. |
| `cost?` | `cost` (nullable, privado) | OK. |
| `unit` (ex.: "cx 500g") | `unit` (NOT NULL, não vazio) | O formulário permite vazio. |
| `minQty` | `min_qty > 0` | OK. |
| `image` (URL, texto) | `image_url` (nullable) | OK. Não há upload, só URL. |
| `category` (texto de `CATEGORIES`) | `category_id` -> `categories` | `CATEGORIES` é fixa no código ("Todos" mais 6). A tabela tem `active` e `sort_order` e comporta categorias novas. |
| `stars` | `stars 1..5` | OK, mas usado como destaque (ver 7.2). |
| `stock` | `stock >= 0` | Edição direta é permitida pelo banco e auditada em `stock_movements` como `ADJUSTMENT`, **sem administrador** se não passar por `adjust_stock`. |
| `flavors?: string[]` | `product_flavors` (1 linha por sabor, `UNIQUE(product_id, name)`) | OK. Estoque compartilhado entre sabores, igual ao frontend. |
| `active` | `active` | OK. |
| `description?` | `description` | Exibida na página do produto, mas **não existe campo no formulário do admin**, então hoje só vem do dado inicial. |
| (não existe) | `unit_description`, `deleted_at` | `deleted_at` é a exclusão lógica. O frontend remove o item da lista. `unit_description` não é usado. |

Telas e regras locais que o banco não reproduz:
- Excluir produto remove da lista. No banco, produto com histórico não apaga (RESTRICT); usa-se `active`/`deleted_at`.
- "Resetar catálogo" restaura `INITIAL_PRODUCTS`. Não tem equivalente e não deve existir com banco.
- `LOW_STOCK_THRESHOLD = 10` está em `config/constants.ts` (10 usos). O banco tem `settings.low_stock_threshold = 10`.
- Card "Valor em Estoque" com legenda "custo total" soma `stock * price` (preço de venda, não custo). O rótulo e o cálculo divergem.

### 3.2 Cliente (`types/customer.ts`, `CustomerFormModal`)

| Frontend | Banco | Observação |
|---|---|---|
| `id` UUID | `customers.id` int | IDs incompatíveis. |
| `code` "CLI-001" (gerado no cliente) | `code` "CLI-000001" (trigger) | O frontend não deve gerar. |
| `personType` `fisica`/`juridica` | `type` `PF`/`PJ` | Mapeamento simples. |
| `name` | `name` | OK. |
| `nomeFantasia` | `trade_name` | OK. |
| `nomeResponsavel` | `responsible_name` | OK. |
| `cpf` / `cnpj` (dois campos, texto livre) | `document` único, só dígitos, `UNIQUE` | O frontend não valida e permite repetir. O banco rejeita duplicado e formato inválido; a API valida dígito verificador. |
| `phone` (texto livre) | `phone NOT NULL`, 10 a 15 dígitos | Só o formulário de orçamento valida (>= 10 dígitos). |
| `email`, `notes` | `email`, `notes` | OK. |
| `cep`, `address`, `addressNumber`, `complement`, `neighborhood`, `city`, `state` | `zip`, `street`, `street_number`, `complement`, `neighborhood`, `city`, `state` | CEP com 8 dígitos e UF em lista fixa no banco. O frontend só limita a 2 letras. |
| `createdAt` | `created_at` | OK. |
| (não existe) | `active` | O frontend exclui de verdade (e apaga as vendas do cliente). |

### 3.3 Venda (`types/sale.ts`, `SaleFormModal`)

| Frontend | Banco | Observação |
|---|---|---|
| `id` UUID | `sales.id` int, `code` "VEN-" (trigger) | O CSV usa `id.slice(0,8)`; deve usar `code`. |
| `customerId` | `customer_id` | Mais snapshots (`customer_name`, `customer_phone`, `customer_document`, `delivery_address`) preenchidos por trigger. |
| `date` | `sale_date` (date) | OK. |
| `items[]` embutidos | `sale_items` | `productId`, `productName`, `productBrand`, `productUnit`, `unitPrice`, `qty`, `subtotal`, `productCost` viram `product_id`, `product_name`, `brand`, `unit`, `unit_price`, `quantity`, `subtotal`, `unit_cost`. |
| `discount` (R$) | `discount` | O banco exige `discount <= subtotal`. O frontend limita o total a `max(0, ...)`, mas aceita desconto maior. |
| `deliveryFee` | `delivery_fee` | OK. |
| `subtotal`, `total` | calculados por trigger | `total = subtotal - discount + delivery_fee`, exato. |
| `paymentMethod` (6 valores) | `payment_method` (CHECK com os mesmos 6) | OK. |
| `paymentStatus` `pendente`/`parcial`/`pago` | `payment_status` `PENDING`/`PARTIAL`/`PAID` | OK. |
| `paidAmount?` | `paid_amount` | O banco exige: PENDING = 0; PARTIAL entre 0 e total (exclusivo); PAID = total. O frontend permite "parcial" sem valor. |
| `saleStatus` `em_andamento`/`concluida`/`cancelada` | `status` `CONFIRMED`/`DELIVERED`/`CANCELED` (mais `DRAFT`) | Máquina de estados no banco (item 8). |
| `notes` | `notes` | OK. |
| `createdAt` | `created_at` | OK. |
| `quoteId?` | (não existe) | Ligação com orçamentos. |
| (não existe) | `order_id`, `created_by_id` | `created_by_id` NOT NULL: vem do JWT (`sub`). |

### 3.4 Pedido da loja (`CustomerInfo`, `CheckoutModal`) -> `orders`

O checkout só monta a mensagem do WhatsApp e abre `wa.me`; **não chama a API**. Mapeamento previsto:

| Checkout | `orders` |
|---|---|
| `personType` fisica/juridica | `customer_type` PF/PJ |
| `name` | `customer_name` |
| `document` (com máscara) | `document` (só dígitos, API valida CPF/CNPJ) |
| `phone` | `phone` (10 ou 11 dígitos na API) |
| `cep`, `address`, `number`, `complement`, `neighborhood`, `city`, `state` | `zip`, `street`, `street_number`, `complement`, `neighborhood`, `city`, `state` |
| itens do carrinho (`id`, `selectedFlavor`, `qty`) | `order_items` + `order_item_flavors` (por nome de sabor) |
| (não existe) | `request_id` (UUID de idempotência, opcional) |

Divergências: `neighborhood` é obrigatório no Zod da API mas o checkout não o exige; o checkout não valida dígito verificador, tamanho do telefone nem UF; o carrinho **não aplica `minQty`** nem confere estoque.

### 3.5 Depoimentos (`data/reviews.ts`) -> `testimonials`

`name`, `city`, `stars`, `text`, `avatar` (iniciais) têm coluna correspondente; `published` e `sort_order` são novos. Os 5 depoimentos do código parecem ser os 5 de exemplo já carregados (não publicados).

### 3.6 Orçamento

Sem tabela (fora do escopo). O frontend depende de `Quote`/`QuoteItem`, `QUOTES_KEY`, `QUOTE_STATUS_CONFIG`, `buildQuoteMessage` e do fluxo "converter em venda" (grava `quoteId` na venda e usa `convertedSaleId`). Lista completa na seção 9.

## 4. Formulários

| Formulário | Campos (obrigatório) | Validações e máscaras |
|---|---|---|
| Produto (admin) | Imagem URL, Nome *, Marca *, Preço *, Custo, Unidade, Qtd. mínima, Categoria, Estrelas, Estoque, Sabores (lista), Ativo | Só nome e marca são checados ao salvar. `type=number` com `min`. Sem máscara. |
| Cliente (admin) | Tipo PF/PJ, Nome/Razão social *, CPF ou CNPJ, Nome fantasia, Responsável, Telefone *, E-mail, Logradouro, Número, Bairro, Complemento, Cidade, UF, CEP, Observações | Sem máscara nem validação de documento, telefone, CEP ou e-mail. UF com `maxLength=2` em maiúsculas. |
| Venda (admin, dentro do cliente) | Data *, itens (produto, qtd, preço unitário), desconto, taxa de entrega, forma e situação do pagamento, valor recebido (se parcial), situação da venda, observações | Exige pelo menos um item e a data. Qtd >= 1 inteira, preço >= 0. Preço unitário editável (negociado). |
| Orçamento (admin) | Cliente (existente ou novo: nome e telefone), itens, desconto (R$ ou %), taxa, validade, previsão de entrega, condições de pagamento, observações do cliente e internas, motivo de não fechamento | Telefone com >= 10 dígitos; desconto não excede subtotal/100%. |
| Checkout (loja) | Tipo, Nome *, CPF/CNPJ *, Telefone *, CEP *, Endereço *, Número *, Complemento, Bairro, Cidade *, Estado * | Máscaras de CPF/CNPJ, telefone e CEP. Só verifica "não vazio". |
| Login (admin) | Usuário, senha | Validação no backend. |

## 5. Relatórios e KPIs

Todos calculados no navegador sobre `Sale[]` do `localStorage` (`lib/reports.ts`, `lib/customers.ts`).

| Número | Cálculo atual | Suporte no banco |
|---|---|---|
| Faturamento | Vendas **concluídas**; soma de `item.subtotal` menos desconto proporcional ao item; **sem** frete | `v_sales_summary.revenue` (apenas `DELIVERED`: `subtotal - discount`). Equivalente por venda. |
| Custo dos produtos | `productCost * qty` dos itens; **nulo** se algum item não tem custo | `cost` na view, nulo por venda se faltar custo. A regra do frontend é por período, a da view por venda. |
| Lucro bruto / Margem bruta | `revenue - cogs` e `% sobre revenue` (nulos com custo incompleto) | `gross_profit` na view (por venda); margem é derivada. |
| Valor recebido | Vendas não canceladas: pago = total (inclui frete), parcial = `paidAmount`; **só sem filtro de produto** | `paid_amount` por venda (soma na API). Há diferença: o frontend inclui `em_andamento`, que no banco é `CONFIRMED`. |
| Valor pendente | Total (ou total - parcial) das não canceladas não pagas | `pending_amount` na view (só `CONFIRMED`/`DELIVERED`; rascunho não conta). |
| Qtd. de vendas | Vendas concluídas no período (com itens do filtro) | `count` sobre a view. |
| Unidades vendidas | Soma de `qty` dos itens | `units` na view, ou soma em `sale_items`. |
| Ticket médio | `revenue / vendas` | Derivado. |
| Variação vs período anterior | `pctChange` entre dois intervalos calculados no cliente | A API precisa aceitar `from`/`to` e o período anterior. |
| Gráfico (faturamento/lucro/unidades) | Agrupa por dia ou por mês, conforme período | Por `sale_date`. Sem agregação pronta; consulta nova. |
| Ranking de produtos | Soma por `productId` de qtd, receita e lucro, ordenado por receita | **Sem view**; precisa agregar `sale_items` (consulta nova, sem mudar tabela). |
| Filtro por produto | Mantém vendas que têm o produto e só os itens dele | `sale_items.product_id`. |
| CSV de vendas | Data, código (`id.slice(0,8)`), cliente, produtos, desconto, faturamento, entrega, total, pagamento, situações | Usar `sales.code` (VEN-). |
| Estatísticas do cliente | `totalComprado` = soma de `total` das concluídas (inclui frete); `valorPendente` = `total` das não pagas, **ignora pagamento parcial**; produto favorito por quantidade; última data; contagens | Usar `v_sales_summary` filtrando por cliente. Nota: a definição de "total comprado" difere de "faturamento" (frete incluso). |
| KPIs de produtos (admin) | Total, ativos, estoque baixo (`stock <= 10`), sem estoque, "valor em estoque" | Derivado de `products`; limite de `settings`. |
| KPIs de clientes (admin) | Total, PF/PJ, faturamento (total concluídas), aguardando pagamento, vendas concluídas | Derivado; ver acima. |

Sobre o tempo: `getSPToday`/`getSPNow` subtraem 3 h fixas do UTC (sem horário de verão, hoje inexistente no Brasil); `sale_date` no banco já usa `America/Sao_Paulo`. A receita de venda entregue é atribuída a `sale_date`; **não há `delivered_at`**, então não dá para saber quando a entrega ocorreu.

## 6. Dados fixos que parecem configuração

| Dado | Onde está | No banco |
|---|---|---|
| Número do WhatsApp `5551982092567` | `config/contact.ts`, usado em `CheckoutModal` e `Footer` | `settings.whatsapp_number` (mesmo valor) |
| Nome "D'mais Comercial de Doces" | Footer, mensagens do WhatsApp (que também usam "D'mais Doceria") | `settings.company_name` |
| Limite de estoque baixo `10` | `config/constants.ts` | `settings.low_stock_threshold` |
| URL da API | `config/env.ts` (`VITE_API_URL`) | Não se aplica |
| Instagram, links "Sobre nós", "Como Comprar", "Prazo de Entrega", "Política de Troca", etc. | `Footer.tsx`, todos `href="#"` (placeholders sem destino) | Sem chave; não há valor real hoje |
| Horário de atendimento, endereço da empresa, e-mail | Não aparecem no código | Sem chave |
| Textos institucionais (Hero, "Nossa História", "Qualidade...", "Facilitar sua vida", "Preços consultados pelo WhatsApp", "pedido mínimo acessível") | `Hero.tsx`, `AboutSection.tsx` | Sem estrutura; conteúdo editorial fixo |
| Imagens (Unsplash para produtos, hero e cards) e logo | `initialProducts.ts`, `Hero.tsx`, `AboutSection.tsx`, `assets/` | `products.image_url` cobre as dos produtos; o resto é fixo |
| Lista de categorias | `config/constants.ts` | `categories` (mesmos 6 nomes) |
| Depoimentos | `data/reviews.ts` | `testimonials` |
| Regras de negócio: unidade ("cx 500g"), pedido mínimo por produto | Dentro de cada produto | `products.unit`, `min_qty` |

`settings` está sob RLS sem acesso público. Hoje a loja não tem como ler esses valores sem um endpoint do backend.

## 7. O que falta ou diverge no banco

### 7.1 Estrutura que falta (tabela/coluna)

Nada é imprescindível para a primeira versão. Itens a avaliar:

| Item | Por quê | Sugestão |
|---|---|---|
| Destaque / "mais vendido" / promoção | A loja usa `stars` como proxy. O banco só tem `stars` (avaliação). | Decidir entre: (a) coluna manual `featured`; (b) ranking calculado de `sale_items` entregues; (c) manter `stars` como hoje. "Promoção" (preço promocional) não existe em lugar nenhum. |
| `delivered_at` em `sales` | Relatórios por data de entrega e auditoria. | Opcional. Hoje a receita usa `sale_date`. |
| Chaves em `settings` (Instagram, e-mail, endereço, horário, textos de política) | Rodapé com links reais. | Só criar quando houver valor; `settings` é chave/valor livre. |
| View de ranking e agregações por período | Dashboard hoje calculado no cliente. | Consultas no backend (ou view), sem nova tabela. |
| Gestão de categorias (criar/editar/ordenar) | `CATEGORIES` fixa no frontend. | Tabela já existe; falta módulo e UI. |
| Gestão de depoimentos (publicar/ordenar) | Hoje só `reviews.ts`. | Tabela existe; falta módulo e UI. |
| `unit_description` | Existe no banco e não é usado no frontend. | Remover do escopo ou expor no formulário. |

### 7.2 Regras do banco que o frontend atual viola

| Regra do banco | Frontend hoje |
|---|---|
| Venda: `DRAFT` -> `CONFIRMED` (baixa estoque) -> `DELIVERED`; `CONFIRMED` -> `CANCELED` estorna; entregue não cancela | Troca livre entre os três status, inclusive reabrir. Edita itens de venda concluída. |
| Itens de venda confirmada são imutáveis; sem DELETE de venda | Edita e apaga venda. |
| Cliente referenciado não pode ser apagado | Apaga cliente e suas vendas. |
| Confirmar baixa estoque; saldo insuficiente aborta | Venda nunca altera estoque. |
| `discount <= subtotal`; `paid_amount` coerente com status | Sem essas travas. |
| Quantidade de produto do catálogo inteira; item avulso (sem `product_id`) até 3 casas e não movimenta estoque | Só produtos do catálogo, qtd inteira. |
| Produto: nome, marca e unidade não vazios | Unidade pode ficar vazia; só nome e marca são checados. |
| Preço/valores `numeric(10,2)` com subtotal `round(qty*preço, 2)` | JavaScript `number` com ponto flutuante (por exemplo, desconto percentual sem arredondar nos orçamentos). |
| Estoque só muda por `confirm_sale`/`cancel_sale`/`adjust_stock` para ter administrador e motivo | Formulário de produto edita `stock` direto. |
| Pedido da loja: mínimo e estoque | Carrinho não aplica `minQty` nem estoque. |

### 7.3 Pontos de atenção na integração

- **IDs:** produtos já são inteiros; clientes e vendas são UUID no frontend e inteiros no banco. Qualquer importação do `localStorage` exige mapeamento (e provavelmente são dados de demonstração).
- **Códigos:** `CLI-` (3 dígitos) e `VEN-`/`ORC-` gerados no cliente não valem; o banco gera `CLI-000001` e `VEN-000001`.
- **Datas:** `createdAt` do frontend é string sem fuso (`getSPNow`); o banco usa `timestamp` UTC e `sale_date` em SP.
- **Admin atribuído:** só `adjust_stock` e `confirm_sale` registram o administrador (`dmais.admin_id`); update direto de `products.stock` gera movimento sem autor.
- **Autenticação do front:** o painel depende de um flag no `sessionStorage`; precisa tratar 401/expiração do JWT (1 dia).

## 8. Decisões pendentes (suas ou do Mateus)

1. **Destaques e promoções da loja:** `featured` manual, ranking por vendas, ou continuar com `stars`? E existe preço promocional?
2. **Fluxo de venda no admin:** montar em rascunho e confirmar (baixa estoque)? Quem confirma a entrega (`DELIVERED`)? Como o admin corrige erro em venda confirmada (cancelar e refazer)?
3. **Pedidos da loja:** a loja passa a enviar para `/api/orders` ao abrir o WhatsApp? Qual tela do admin lista e converte pedido em venda (`sales.order_id`)?
4. **Ajuste de estoque:** só via `adjust_stock` (com motivo) em tela própria, removendo o campo "Estoque" do formulário de produto?
5. **Exclusão:** produtos e clientes passam a "inativar"? Remover "Resetar catálogo".
6. **Dados de `localStorage`:** descartar (são de demonstração) ou migrar?
7. **Relatórios:** a base de "faturamento" é `sale_date` ou data de entrega (exigiria `delivered_at`)? "Total comprado" do cliente inclui frete?
8. **Configurações públicas:** endpoint `GET /api/settings` (ou view) com WhatsApp, nome e limite de estoque baixo.
9. **Textos e links do Footer:** quais links reais existem (Instagram, políticas)? Viram `settings`?
10. **Validação:** alinhar frontend com Zod (CPF/CNPJ, telefone 10 a 11, CEP, UF, bairro obrigatório) e com `minQty` no carrinho.

## 9. Dependências de orçamento no frontend (referência)

Não há tabela, API nem ligação prevista no banco.

- Código: `components/admin/quotes/*` (`ConvertModal`, `ItemRow`, `QuoteCard`, `QuoteFormModal`, `WhatsAppModal`, `CustomerSearchBox`), `pages/admin/quotes/AdminQuotes.tsx`, `lib/quotes.ts`, `types/quote.ts`.
- Compartilhado: aba "orçamentos" em `AdminPanel.tsx`, `QUOTES_KEY` em `config/constants.ts`, `QUOTE_STATUS_CONFIG` em `config/labels.ts`, `buildQuoteMessage` em `lib/whatsapp.ts`, reexport em `types/index.ts`.
- Ligação com vendas: `Sale.quoteId` (`types/sale.ts`) e `Quote.convertedSaleId`; "converter" cria uma venda `em_andamento` com `quoteId`. O cadastro rápido de cliente do orçamento também grava em `dmais_customers`.

## 10. Ordem sugerida para os módulos de API

1. `settings` público (somente leitura) e `products`/`categories` (leitura pública pela `v_store_products`; escrita admin com `adjust_stock`).
2. `customers` (CRUD com inativação, validação de documento e unicidade).
3. `sales` (rascunho, itens, `confirm_sale`, `cancel_sale`, entrega) com `created_by_id` do JWT.
4. Ligação loja -> `/api/orders` e tela de solicitações no admin.
5. `reports` (agregações por período sobre `v_sales_summary` e `sale_items`).
6. `testimonials` (leitura pública e gestão).
