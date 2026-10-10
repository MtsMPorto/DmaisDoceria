# Decisões da Fase 3

Este documento registra, em linguagem simples, o que foi decidido depois da auditoria entre o site e o banco de dados (`docs/AUDITORIA-FRONTEND-BANCO.md`) e como ficou na prática. Serve para o Mateus e para o titular saberem o que mudou.

## O que foi decidido (e como ficou)

1. **Destaques e promoções.** Continua como está: a quantidade de estrelas do produto decide o que aparece em "Mais vendidos" e em "Promoções". O banco não mudou.

2. **Como funciona uma venda.**
   - A venda começa como rascunho.
   - Ao confirmar, o estoque é descontado pelo banco.
   - Depois é marcada como entregue.
   - Se houver erro em uma venda confirmada, ela é cancelada (o estoque volta, uma única vez) e refeita.
   - Uma venda já entregue não pode ser cancelada.
   - Itens, desconto e frete só mudam em rascunho; pagamento e observações podem mudar depois.

3. **Pedidos feitos na loja.**
   - Ao finalizar, o site registra o pedido no sistema e só depois abre o WhatsApp. A mensagem usa os dados oficiais devolvidos pelo sistema (nome, marca, unidade e preço do catálogo).
   - Se o registro falhar, o site mostra o erro e deixa tentar de novo, sem abrir o WhatsApp. A mesma tentativa usa o mesmo identificador, então não duplica o pedido.
   - O pedido não baixa nem reserva estoque. Abaixo do mínimo, o envio é bloqueado; acima do estoque é só aviso (o banco decide).
   - No painel, a tela **Solicitações** lista os pedidos, permite "Criar venda a partir do pedido" e "Cancelar". O pedido só vira "confirmado" quando a venda vinculada é confirmada.

4. **Estoque.**
   - O campo "Estoque" saiu do formulário de edição do produto.
   - Ao cadastrar um produto novo, o saldo inicial é permitido (registrado com o administrador).
   - Depois disso, o saldo só muda pela ação "Ajustar estoque", com motivo obrigatório.

5. **Produtos e clientes não são apagados.** Eles são inativados. O botão "Resetar catálogo" deixou de existir.

6. **Dados salvos no navegador (localStorage).** Foram descartados, sem migração (aguarda a confirmação do titular). Só os orçamentos continuam no navegador, de forma provisória.

7. **Relatórios.**
   - Faturamento = subtotal menos desconto das vendas **entregues**, pela data da venda, sem frete.
   - Custo e lucro só aparecem quando todos os itens vendidos têm custo cadastrado; senão ficam "indisponíveis" (nunca lucro com custo zero).
   - "Total comprado" do cliente = total com frete das vendas entregues, e o rótulo deixa isso claro.
   - "Valor pendente" usa o valor calculado pelo banco (`pending_amount`).

8. **Configurações públicas.** A loja lê só o número do WhatsApp e o nome da empresa. O limite de estoque baixo só aparece para o administrador.
   - *Duplicação registrada:* a loja ainda usa o limite de estoque baixo (10) como constante no código para o aviso "últimas unidades"; o painel lê o valor do banco.

9. **Rodapé.** Os links que ainda não levam a lugar nenhum foram escondidos. O WhatsApp e o nome da empresa vêm da API.

10. **Validações.** Os formulários do site seguem as mesmas regras do sistema e do banco (CPF/CNPJ com dígito verificador, telefone com DDD, CEP, UF, bairro obrigatório no pedido).

11. **Rótulo.** "Valor em Estoque" virou "Valor de venda do estoque" (estoque × preço de venda).

12. **Orçamentos.** O código não foi apagado. A aba "Orçamentos" fica escondida por `SHOW_QUOTES = false`. É a única parte que ainda usa `localStorage` (provisório).

## Risco registrado: token do painel

O token de login (JWT) fica em `sessionStorage`. Qualquer script da página consegue lê-lo; uma falha de XSS (inclusive em dependência de terceiros) permitiria roubar a sessão. Mitigações já existentes: expira em 1 dia (`JWT_EXPIRES_IN`), o servidor confere a cada requisição se o administrador ainda está ativo, e o painel só abre depois que o servidor confirma o token. Alternativa mais segura (cookie `HttpOnly` com proteção CSRF) fica como evolução e **não foi alterada sem aval**.

## Regras que o código segue

- O estoque nunca é alterado por UPDATE direto: saldo inicial no cadastro, `adjust_stock` para ajustes, `confirm_sale`/`cancel_sale` para vendas.
- O identificador do administrador vem sempre do token, nunca do corpo da requisição.
- O custo do produto nunca aparece em resposta pública.
- Nada é apagado fisicamente (só item de venda em rascunho pode ser removido).

## Pendências

- Confirmação do titular sobre descartar os dados do navegador (item 6).
- Banco de testes (`DATABASE_URL_TEST`) para rodar os testes de integração.
- Destino do módulo de orçamentos.
