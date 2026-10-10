# D'mais Comercial de Doces

## Objetivo do projeto

A D'mais Comercial de Doces revende doces para empresas e consumidores finais. O site funciona como um catálogo digital com carrinho e atendimento pelo WhatsApp.

O cliente acessa o catálogo, encontra os produtos desejados, escolhe sabores e quantidades e informa seus dados. Ao concluir essa seleção, o site abre o WhatsApp da empresa para continuar o atendimento.

Não existe pagamento online no site. A confirmação da compra, as condições de pagamento e os detalhes de entrega são combinados com a empresa pelo WhatsApp.

## Regra de negócio principal

O carrinho representa uma intenção de compra. Adicionar produtos ao carrinho ou abrir o WhatsApp não significa que a venda foi concluída.

A mensagem é montada automaticamente pelo site, mas o cliente precisa confirmar seu envio no WhatsApp. O redirecionamento, sozinho, não comprova que a empresa recebeu o pedido.

O fluxo principal deve ser:

1. Acessar o catálogo sem necessidade de login.
2. Buscar produtos e navegar pelas categorias.
3. Consultar os detalhes do produto.
4. Selecionar sabores, quando disponíveis, e quantidades.
5. Adicionar produtos ao carrinho.
6. Revisar os itens, alterar quantidades ou remover produtos.
7. Preencher os dados do cliente.
8. Clicar em “Enviar pedido pelo WhatsApp”.
9. Continuar o atendimento com a empresa no WhatsApp.

A etapa de identificação do cliente não é um checkout de pagamento, mesmo que alguns componentes do código utilizem o nome `checkout`.

## Produtos e carrinho

O cadastro de produto contempla nome, marca, descrição, imagem, categoria, preço, unidade de venda, quantidade mínima, estoque, sabores e situação ativa ou inativa.

As seguintes regras orientam a evolução do sistema:

- Produtos inativos não devem estar disponíveis para novos pedidos.
- Quando o produto possuir sabores, o pedido deve identificar o sabor escolhido.
- O mesmo produto com sabores diferentes deve aparecer em itens separados.
- Adições do mesmo produto e sabor devem acumular a quantidade.
- As quantidades devem ser inteiras e positivas.
- A unidade de venda deve ficar clara, como unidade, pacote ou caixa.
- A quantidade mínima e a disponibilidade de estoque devem ser respeitadas na seleção e novamente verificadas antes de preparar o pedido.
- Um carrinho vazio não deve permitir iniciar uma solicitação.
- Alterações no catálogo devem ser consideradas ao validar um carrinho já aberto.

O modelo atual possui os campos de estoque e quantidade mínima, mas ainda precisa de validações completas para garantir essas regras em todo o fluxo.

## Dados do cliente

O atendimento contempla dois tipos de cliente:

- Pessoa física: nome completo e CPF.
- Pessoa jurídica: razão social e CNPJ.

O formulário também contempla telefone/WhatsApp e endereço de entrega, com CEP, logradouro, número, complemento, bairro, cidade e estado. O complemento é opcional.

Atualmente, esses dados são preenchidos durante a preparação do pedido. Não existe uma conta de cliente com login, cadastro persistente ou área pessoal. Mas futuramente irá ter um botão na parte superior esquerda onde o usuário irá ter acesso a sua conta e a úninca alteração do cliente será alterar seus dados. Não tem necessidade de ter muitas configurações de usuário pela venda ser feita pelo WhatsApp.

## Mensagem para o WhatsApp

A mensagem deve apresentar:

- Identificação da D'mais Comercial de Doces.
- Nome ou razão social do cliente.
- Tipo de pessoa e CPF ou CNPJ.
- Telefone de contato.
- Endereço de entrega.
- Produtos selecionados, com nome, marca, descrição, unidade de venda, sabor e quantidade.

No código atual, a mensagem já inclui os dados do cliente, endereço, nome do produto, marca, unidade, sabor e quantidade. A descrição do produto ainda precisa ser incluída.

Os preços e o total não aparecem na mensagem atual. Qualquer futura inclusão de valores deve deixar claro quando eles dependerem de confirmação comercial.

O número de destino está centralizado em `frontend/src/config/contact.ts`.

## Área administrativa

A área administrativa tem como objetivo permitir que a empresa gerencie o catálogo, acompanhe o estoque e consulte o relacionamento comercial com seus clientes.

### Funcionalidades atuais

- Adicionar, editar e excluir produtos.
- Ativar e desativar produtos.
- Gerenciar sabores e informações comerciais.
- Alterar a quantidade de estoque cadastrada.
- Buscar produtos e filtrar por categoria.
- Ordenar produtos por nome, preço ou estoque.
- Consultar indicadores do catálogo, incluindo produtos ativos, estoque baixo e produtos sem estoque.
- Restaurar o catálogo demonstrativo inicial.

Atualmente, estoque baixo corresponde a produtos ativos com até 10 unidades. O estoque é registrado por produto, sem controle individual por sabor.

### Funcionalidades planejadas

- Cadastro persistente de clientes.
- Registro e acompanhamento de solicitações de pedido.
- Registro das vendas confirmadas pela empresa.
- Histórico de compras por cliente.
- Relatórios com produtos, sabores, quantidades e datas das compras.
- Controle de movimentações de estoque vinculado às vendas confirmadas.
- Autenticação e autorização administrativas por backend.

O histórico deve distinguir uma solicitação de uma compra confirmada. Abrir o WhatsApp não deve registrar automaticamente uma venda nem provocar baixa definitiva de estoque.

Como o site não acompanha a conversa no WhatsApp, a confirmação da venda deverá ocorrer por registro administrativo ou por uma futura integração definida para esse propósito.

## Rotas

### Cliente

| Rota | Finalidade |
| --- | --- |
| `/` | Página principal, catálogo, busca e navegação por categorias. |
| `/product/:id` | Detalhes de um produto identificado pelo seu ID. |

O carrinho, a escolha de sabores e o formulário de dados do cliente são apresentados em painéis ou modais. Atualmente, não possuem rotas próprias.

Não existem rotas de login, cadastro, pagamento ou histórico de pedidos do cliente.

### Administrador

| Rota | Finalidade |
| --- | --- |
| `/admin` | Tela de acesso administrativo. |
| `/admin/panel` | Painel de gerenciamento do catálogo e estoque. |

O painel possui uma verificação de sessão no navegador que redireciona para `/admin` quando não há sessão demonstrativa ativa.

Ainda não existem rotas específicas para clientes, vendas ou relatórios. Essas áreas fazem parte da evolução planejada.

## Identidade visual

O site deve manter uma aparência acolhedora, organizada e relacionada ao universo dos doces, com boa legibilidade e destaque para produtos e ações de pedido.

### Cores

| Cor | Código | Aplicação |
| --- | --- | --- |
| Azul principal | `#1A2B6B` | Identidade da marca, títulos, cabeçalhos e elementos principais. |
| Laranja | `#F97316` | Destaques, ações e estados de foco. |
| Creme claro | `#FFF8F0` | Fundo principal da loja. |
| Creme secundário | `#FFF0DC` | Campos e superfícies secundárias. |
| Bege suave | `#F5EDE0` | Áreas de apoio. |
| Marrom acinzentado | `#6B5E4A` | Textos secundários. |
| Branco | `#FFFFFF` | Cartões e contraste sobre fundos coloridos. |
| Verde WhatsApp | `#25D366` | Ações relacionadas ao WhatsApp. |
| Vermelho | `#D4183D` | Ações destrutivas e indicação de erro. |
| Cinza claro | `#F4F6FA` | Fundo do painel administrativo. |

As cores principais estão definidas no tema em `src/styles/theme.css`. Novos componentes devem reutilizar os padrões existentes.

### Fontes

- **Nunito:** textos, formulários, botões e elementos gerais da interface.
- **Baloo 2:** títulos e destaques da marca.

As fontes são importadas em `src/styles/fonts.css`.

### Padrões de interface

Manter cantos arredondados, cartões de produtos, botões de fácil identificação e espaçamento confortável. A interface deve funcionar em celulares, tablets e computadores, preservando o acesso ao catálogo, ao carrinho e ao WhatsApp.

## Estado atual e orientações para desenvolvimento

O projeto utiliza React, TypeScript, Vite e Tailwind CSS.

A versão atual é um frontend demonstrativo:

- O catálogo é armazenado no `localStorage` do navegador e não é compartilhado entre dispositivos.
- O carrinho permanece em memória.
- O login administrativo e a verificação em duas etapas são demonstrativos.
- Não existe backend de clientes, pedidos ou vendas.
- Não existem relatórios reais de compras.
- Não existe processamento de pagamentos.

Ao desenvolver novas funcionalidades, preservar o objetivo central: facilitar a escolha dos produtos e encaminhar uma solicitação organizada para o WhatsApp.

Não introduzir checkout de pagamento ou tratar o redirecionamento como venda concluída sem uma mudança explícita de escopo. Funcionalidades planejadas devem permanecer identificadas como pendentes até serem efetivamente implementadas.