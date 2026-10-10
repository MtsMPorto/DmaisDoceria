# Banco de dados

1. **Criação.** O banco é criado pelo [`supabase/schema.sql`](supabase/schema.sql), que é cópia do que está no Supabase. Ele é a fonte da verdade da estrutura, das regras (triggers, funções, views) e das permissões (RLS).
2. **Papel do Prisma.** O Prisma é só cliente de acesso e introspecção. O `backend/prisma/schema.prisma` reflete o banco, e não o contrário.
3. **Comandos proibidos.** Nunca rode `prisma migrate dev`, `prisma db push` nem `prisma migrate reset` neste banco.
4. **Mudanças de estrutura.** São feitas em SQL (e o `schema.sql` é atualizado junto) e depois refletidas com `npx prisma db pull` e `npx prisma generate`.
5. **Baseline.** O `backend/prisma/migrations/0_init` serve só como registro de baseline. Ele não recria triggers, RLS, funções nem views, então **não** use `prisma migrate deploy` para criar um banco novo: para isso, execute o `schema.sql` inteiro no SQL Editor.
