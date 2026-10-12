-- Aplicar uma vez no SQL Editor do Supabase, antes de publicar o novo backend.
-- Não executa seed, não remove clientes/vendas e não altera CPFs históricos.
BEGIN;

CREATE TABLE public.customer_accounts (
  id serial PRIMARY KEY,
  email varchar(150) NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  password_hash text NOT NULL,
  customer_id integer UNIQUE REFERENCES public.customers(id) ON DELETE RESTRICT,
  pending_profile jsonb,
  verified_at timestamp(3),
  session_version integer NOT NULL DEFAULT 0,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp(3),
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (verified_at IS NULL OR customer_id IS NOT NULL)
);
CREATE TABLE public.account_challenges (
  id uuid PRIMARY KEY,
  account_id integer NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('signup','recovery','email')),
  email varchar(150) NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp(3) NOT NULL,
  verified_at timestamp(3),
  reset_hash text UNIQUE,
  UNIQUE(account_id, purpose)
);
CREATE INDEX account_challenges_expires_at_idx ON public.account_challenges(expires_at);
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_accounts, public.account_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.customer_accounts_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_accounts, public.account_challenges TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.customer_accounts_id_seq TO service_role;

ALTER TABLE public.orders ALTER COLUMN document DROP NOT NULL;
-- O nome do CHECK foi gerado pelo PostgreSQL; identificar pela expressão evita
-- depender da numeração do nome e preserva todos os outros CHECKs.
DO $$ DECLARE rule record;
BEGIN
  FOR rule IN SELECT conname FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) LIKE '%customer_type%' AND pg_get_constraintdef(oid) LIKE '%document%'
  LOOP EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', rule.conname); END LOOP;
END $$;
ALTER TABLE public.orders ADD CONSTRAINT orders_document_by_type CHECK (
  (customer_type='PF' AND (document IS NULL OR document ~ '^[0-9]{11}$')) OR
  (customer_type='PJ' AND document IS NOT NULL AND document ~ '^[0-9A-Z]{12}[0-9]{2}$')
);

-- As funções abaixo mantêm todas as proteções anteriores. Para novos pedidos
-- autenticados, a identidade é o customer_id; CPF deixa de ser necessário.
CREATE OR REPLACE FUNCTION dmais_private.fill_customer_snapshot() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE c public.customers; o public.orders;
BEGIN
  SELECT * INTO STRICT c FROM public.customers WHERE id = NEW.customer_id;
  IF NOT c.active THEN RAISE EXCEPTION 'Cliente inativo.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = NEW.created_by_id AND active) THEN
    RAISE EXCEPTION 'Administrador inativo ou inexistente.';
  END IF;
  NEW.customer_name := c.name;
  NEW.customer_phone := c.phone;
  NEW.customer_document := c.document;
  NEW.delivery_address := jsonb_build_object('zip', c.zip, 'street', c.street,
    'number', c.street_number, 'complement', c.complement, 'neighborhood', c.neighborhood,
    'city', c.city, 'state', c.state);
  IF NEW.order_id IS NOT NULL THEN
    SELECT * INTO STRICT o FROM public.orders WHERE id = NEW.order_id;
    IF (o.customer_id IS NOT NULL AND o.customer_id <> c.id) OR
      (o.customer_id IS NULL AND (c.document IS DISTINCT FROM o.document OR c.type <> o.customer_type)) THEN RAISE EXCEPTION 'Pedido pertence a outro cliente.'; END IF;
    NEW.customer_name := o.customer_name; NEW.customer_phone := o.phone;
    NEW.customer_document := o.document;
    NEW.delivery_address := jsonb_build_object('zip', o.zip, 'street', o.street,
      'number', o.street_number, 'complement', o.complement, 'neighborhood', o.neighborhood,
      'city', o.city, 'state', o.state);
  END IF;
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := 'VEN-' || lpad(NEW.id::text, greatest(6, length(NEW.id::text)), '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dmais_private.guard_order() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'REQUESTED' THEN RAISE EXCEPTION 'Pedido deve iniciar como REQUESTED.'; END IF;
    IF NEW.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND type = NEW.customer_type AND ((NEW.customer_type = 'PF' AND NEW.document IS NULL) OR document IS NOT DISTINCT FROM NEW.document)) THEN
      RAISE EXCEPTION 'Cliente e documento da solicitação não correspondem.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Cancele o pedido para preservar o histórico.'; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','updated_at','customer_id']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at','customer_id']) THEN
    RAISE EXCEPTION 'Os dados originais da solicitação não podem ser alterados.';
  END IF;
  IF NEW.status <> OLD.status AND NOT ((OLD.status = 'REQUESTED' AND NEW.status IN ('CONFIRMED','CANCELED')) OR (OLD.status = 'CONFIRMED' AND NEW.status = 'CANCELED')) THEN
    RAISE EXCEPTION 'Transição de pedido inválida.';
  END IF;
  IF NEW.status = 'CANCELED' AND EXISTS (SELECT 1 FROM public.sales WHERE order_id = OLD.id AND status IN ('CONFIRMED','DELIVERED')) THEN
    RAISE EXCEPTION 'Cancele primeiro a venda vinculada.';
  END IF;
  IF OLD.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN RAISE EXCEPTION 'Não é permitido trocar o cliente vinculado.'; END IF;
  IF OLD.customer_id IS NULL AND NEW.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND type = NEW.customer_type AND document IS NOT DISTINCT FROM NEW.document) THEN
    RAISE EXCEPTION 'Cliente e documento da solicitação não correspondem.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dmais_private.guard_sale() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE r record; p public.products; o public.orders;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN RAISE EXCEPTION 'Crie a venda em DRAFT, inclua itens e confirme.'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Cancele a venda para preservar o histórico.'; END IF;
  IF NEW.customer_id <> OLD.customer_id OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.created_by_id <> OLD.created_by_id OR NEW.code <> OLD.code THEN
    RAISE EXCEPTION 'Origem e identificação da venda são imutáveis.';
  END IF;
  IF OLD.status <> 'DRAFT' AND (to_jsonb(NEW) - ARRAY['status','updated_at','payment_method','payment_status','paid_amount','notes']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at','payment_method','payment_status','paid_amount','notes']) THEN
    RAISE EXCEPTION 'Itens e valores de uma venda confirmada são imutáveis.';
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status = 'DRAFT' AND NEW.status IN ('CONFIRMED','CANCELED')) OR
    (OLD.status = 'CONFIRMED' AND NEW.status IN ('DELIVERED','CANCELED'))) THEN
    RAISE EXCEPTION 'Transição de venda inválida. Após entrega, trate a devolução separadamente.';
  END IF;
  IF OLD.status = 'DRAFT' AND NEW.status = 'CONFIRMED' THEN
    IF NOT EXISTS (SELECT 1 FROM public.sale_items WHERE sale_id = NEW.id) THEN RAISE EXCEPTION 'Venda vazia.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = NEW.created_by_id AND active) THEN RAISE EXCEPTION 'Administrador inativo.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND active) THEN RAISE EXCEPTION 'Cliente inativo.'; END IF;
    IF NEW.order_id IS NOT NULL THEN
      SELECT * INTO STRICT o FROM public.orders WHERE id = NEW.order_id FOR UPDATE;
      IF o.status = 'CANCELED' OR (o.customer_id IS NOT NULL AND o.customer_id <> NEW.customer_id) OR
        NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND (o.customer_id IS NOT NULL OR (type = o.customer_type AND document IS NOT DISTINCT FROM o.document))) THEN
        RAISE EXCEPTION 'Pedido cancelado ou cliente diferente da solicitação.';
      END IF;
    END IF;
    -- Mesma ordem de bloqueio em todas as vendas evita inversão de locks.
    FOR r IN SELECT product_id, sum(quantity) qty FROM public.sale_items WHERE sale_id = NEW.id AND product_id IS NOT NULL GROUP BY product_id ORDER BY product_id LOOP
      SELECT * INTO STRICT p FROM public.products WHERE id = r.product_id FOR UPDATE;
      IF NOT p.active OR p.deleted_at IS NOT NULL OR r.qty < p.min_qty OR r.qty > p.stock OR
        NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p.category_id AND active) THEN
        RAISE EXCEPTION 'Produto % indisponível ou quantidade fora do mínimo/estoque.', p.id;
      END IF;
      IF EXISTS (SELECT 1 FROM public.sale_items i LEFT JOIN public.product_flavors f ON f.id = i.flavor_id
        WHERE i.sale_id = NEW.id AND i.product_id = p.id AND
        ((i.flavor_id IS NULL AND EXISTS (SELECT 1 FROM public.product_flavors WHERE product_id = p.id)) OR
         (i.flavor_id IS NOT NULL AND (f.product_id <> p.id OR NOT f.active)))) THEN
        RAISE EXCEPTION 'Selecione sabores válidos antes de confirmar a venda.';
      END IF;
      PERFORM set_config('dmais.sale_id', NEW.id::text, true);
      PERFORM set_config('dmais.admin_id', NEW.created_by_id::text, true);
      PERFORM set_config('dmais.stock_kind', 'SALE', true);
      PERFORM set_config('dmais.stock_reason', 'Confirmação da venda ' || NEW.code, true);
      UPDATE public.products SET stock = stock - r.qty::integer WHERE id = p.id;
    END LOOP;
  ELSIF OLD.status = 'CONFIRMED' AND NEW.status = 'CANCELED' THEN
    FOR r IN SELECT product_id, -quantity qty FROM public.stock_movements WHERE sale_id = NEW.id AND kind = 'SALE' ORDER BY product_id LOOP
      PERFORM set_config('dmais.sale_id', NEW.id::text, true);
      PERFORM set_config('dmais.admin_id', NEW.created_by_id::text, true);
      PERFORM set_config('dmais.stock_kind', 'CANCELLATION', true);
      PERFORM set_config('dmais.stock_reason', 'Cancelamento antes da entrega: ' || NEW.code, true);
      UPDATE public.products SET stock = stock + r.qty WHERE id = r.product_id;
    END LOOP;
  END IF;
  PERFORM set_config('dmais.sale_id', '', true);
  PERFORM set_config('dmais.admin_id', '', true);
  PERFORM set_config('dmais.stock_kind', '', true);
  PERFORM set_config('dmais.stock_reason', '', true);
  RETURN NEW;
END;
$$;

COMMIT;
