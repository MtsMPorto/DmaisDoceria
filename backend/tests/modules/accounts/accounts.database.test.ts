import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { hashSync } from "bcryptjs";

// PostgreSQL temporário em memória. Nunca importa env.ts/prisma.ts nem usa DATABASE_URL.
it("SQL: instala contas, migra legado, preserva histórico e confirma pedido PF sem CPF", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    await db.exec(
      readFileSync(
        new URL("../../../../database/supabase/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    // Reconstitui a estrutura anterior das tabelas afetadas, mantendo os triggers reais.
    await db.exec(`DROP TABLE public.account_challenges; DROP TABLE public.customer_accounts;
      ALTER TABLE public.orders ALTER COLUMN document SET NOT NULL;
      INSERT INTO public.admin_users(name,username,password_hash) VALUES ('Admin teste','test','${hashSync("test-only-password", 4)}');
      INSERT INTO public.customers(code,type,name,document,phone,email) VALUES ('','PF','Cliente legado','12345678909','51999998888','legado@example.com');
      INSERT INTO public.products(name,brand,category_id,price,unit,stock) VALUES ('Produto teste','Marca',1,10,'pacote',20);`);
    await db.exec(
      readFileSync(
        new URL(
          "../../../../database/supabase/updates/20261012_customer_accounts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const legacy = await db.query<{ document: string }>(
      "SELECT document FROM public.customers WHERE id=1",
    );
    assert.equal(legacy.rows[0].document, "12345678909");
    await db.exec(`BEGIN;
      INSERT INTO public.orders(customer_id,customer_type,customer_name,document,phone,zip,street,street_number,neighborhood,city,state)
        VALUES (1,'PF','Cliente legado',NULL,'51999998888','01001000','Praça da Sé','10','Sé','São Paulo','SP');
      INSERT INTO public.order_items(order_id,product_id,product_name,brand,unit,min_qty,total_quantity) VALUES (1,1,'','', '',1,2);
      INSERT INTO public.order_item_flavors(order_item_id,quantity) VALUES (1,2);
      COMMIT;
      INSERT INTO public.customer_accounts(email,password_hash,customer_id,verified_at) VALUES ('legado@example.com','hash',1,now());
      INSERT INTO public.sales(code,customer_id,order_id,customer_name,customer_phone,created_by_id) VALUES ('',1,1,'','',1);
      INSERT INTO public.sale_items(sale_id,product_id,product_name,quantity,unit_price,subtotal) VALUES (1,1,'',2,10,20);
      SELECT public.confirm_sale(1);`);
    const result = await db.query<{ status: string; document: null }>(
      "SELECT status,document FROM public.orders WHERE id=1",
    );
    assert.equal(result.rows[0].status, "CONFIRMED");
    assert.equal(result.rows[0].document, null);
    assert.equal(
      (
        await db.query<{ stock: number }>(
          "SELECT stock FROM public.products WHERE id=1",
        )
      ).rows[0].stock,
      18,
    );
    const permissions = await db.query<{ allowed: boolean }>(
      "SELECT has_table_privilege('anon','public.customer_accounts','SELECT') AS allowed",
    );
    assert.equal(permissions.rows[0].allowed, false);
    await assert.rejects(
      db.exec(
        "INSERT INTO public.customer_accounts(email,password_hash) VALUES ('legado@example.com','hash')",
      ),
      /unique/i,
    );
    await assert.rejects(
      db.exec("UPDATE public.orders SET customer_id=999 WHERE id=1"),
    );
  } finally {
    await db.close();
  }
});
