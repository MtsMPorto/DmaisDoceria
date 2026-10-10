-- D'mais Comercial de Doces — PostgreSQL 15+ / Supabase.
-- INSTALAÇÃO INICIAL: execute este arquivo INTEIRO no SQL Editor como postgres.
-- Não é uma migração de banco existente. Não apaga nem substitui tabelas.
-- Base: SiteDocesMR (frontend + backend Prisma), revisada em 09/10/2026.
-- Autenticação administrativa: backend Express + bcrypt/JWT já existente.
-- Supabase Auth NÃO é ativado nem modificado por este arquivo.

BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL timezone = 'UTC';

-- Se qualquer objeto já existir, o PostgreSQL interrompe e desfaz a instalação.
CREATE SCHEMA dmais_private;
REVOKE ALL ON SCHEMA dmais_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA dmais_private TO service_role;

CREATE TYPE public.customer_type AS ENUM ('PF', 'PJ');
CREATE TYPE public.order_status AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELED');
CREATE TYPE public.sale_status AS ENUM ('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELED');
CREATE TYPE public.payment_status AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- 1. CATÁLOGO. Estoque por embalagem comercial, compartilhado entre sabores.
CREATE TABLE public.categories (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now())
);

CREATE TABLE public.products (
  id serial PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  brand text NOT NULL CHECK (btrim(brand) <> ''),
  description text,
  image_url text,
  category_id integer NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  price numeric(10,2) NOT NULL CHECK (price >= 0 AND price <> 'NaN'::numeric),
  cost numeric(10,2) CHECK (cost >= 0 AND cost <> 'NaN'::numeric),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  unit_description text,
  min_qty integer NOT NULL DEFAULT 1 CHECK (min_qty > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active boolean NOT NULL DEFAULT true,
  stars integer NOT NULL DEFAULT 5 CHECK (stars BETWEEN 1 AND 5),
  deleted_at timestamp(3),
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now())
);
CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_store_idx ON public.products(category_id, name) WHERE active AND deleted_at IS NULL;

CREATE TABLE public.product_flavors (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  UNIQUE (product_id, name)
);

-- 2. ADMINISTRADORES. Hash bcrypt compatível com bcryptjs; nunca senha pura.
CREATE TABLE public.admin_users (
  id serial PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  username text NOT NULL UNIQUE CHECK (btrim(username) <> ''),
  password_hash text NOT NULL CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'),
  active boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamp(3),
  last_login_at timestamp(3),
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now())
);

-- 3. CLIENTES. Um endereço atual por cliente, como no formulário atual.
-- Endereço e identificação são copiados nos documentos comerciais.
CREATE TABLE public.customers (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  type public.customer_type NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  trade_name text,
  responsible_name text,
  document varchar(14) UNIQUE,
  phone varchar(20) NOT NULL CHECK (phone ~ '^[0-9]{10,15}$'),
  email text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  zip varchar(8) CHECK (zip IS NULL OR zip ~ '^[0-9]{8}$'),
  street text,
  street_number text,
  complement text,
  neighborhood text,
  city text,
  state varchar(2) CHECK (state IS NULL OR state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  CHECK (document IS NULL OR (type = 'PF' AND document ~ '^[0-9]{11}$') OR (type = 'PJ' AND document ~ '^[0-9A-Z]{12}[0-9]{2}$'))
);
CREATE INDEX customers_name_idx ON public.customers(name);
CREATE INDEX customers_phone_idx ON public.customers(phone);

-- 4. SOLICITAÇÕES DA LOJA. Não são vendas; não baixam nem reservam estoque.
CREATE TABLE public.orders (
  id serial PRIMARY KEY,
  request_id text UNIQUE,
  status public.order_status NOT NULL DEFAULT 'REQUESTED',
  customer_id integer REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_type public.customer_type NOT NULL,
  customer_name text NOT NULL CHECK (btrim(customer_name) <> ''),
  document varchar(14) NOT NULL,
  phone varchar(15) NOT NULL CHECK (phone ~ '^[0-9]{10,15}$'),
  zip varchar(8) NOT NULL CHECK (zip ~ '^[0-9]{8}$'),
  street text NOT NULL CHECK (btrim(street) <> ''),
  street_number text NOT NULL CHECK (btrim(street_number) <> ''),
  complement text,
  neighborhood text,
  city text NOT NULL CHECK (btrim(city) <> ''),
  state varchar(2) NOT NULL CHECK (state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  CHECK (request_id IS NULL OR btrim(request_id) <> ''),
  CHECK ((customer_type = 'PF' AND document ~ '^[0-9]{11}$') OR (customer_type = 'PJ' AND document ~ '^[0-9A-Z]{12}[0-9]{2}$'))
);
CREATE INDEX orders_customer_idx ON public.orders(customer_id);
CREATE INDEX orders_status_date_idx ON public.orders(status, created_at DESC, id DESC);
CREATE INDEX orders_date_idx ON public.orders(created_at DESC, id DESC);

CREATE TABLE public.order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  brand text NOT NULL,
  description text,
  unit text NOT NULL,
  min_qty integer NOT NULL CHECK (min_qty > 0),
  unit_price numeric(10,2) CHECK (unit_price >= 0 AND unit_price <> 'NaN'::numeric),
  total_quantity integer NOT NULL CHECK (total_quantity > 0),
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  UNIQUE (order_id, product_id)
);
CREATE INDEX order_items_product_idx ON public.order_items(product_id);

CREATE TABLE public.order_item_flavors (
  id serial PRIMARY KEY,
  order_item_id integer NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  flavor_id integer REFERENCES public.product_flavors(id) ON DELETE RESTRICT,
  flavor_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  UNIQUE NULLS NOT DISTINCT (order_item_id, flavor_id)
);
CREATE INDEX order_item_flavors_flavor_idx ON public.order_item_flavors(flavor_id);

-- Um sabor conserva o produto de origem, inclusive depois de aparecer no histórico.
CREATE FUNCTION dmais_private.keep_flavor_product() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  IF NEW.product_id <> OLD.product_id THEN RAISE EXCEPTION 'Não mova um sabor para outro produto; cadastre um novo sabor.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER flavors_keep_product BEFORE UPDATE ON public.product_flavors FOR EACH ROW EXECUTE FUNCTION dmais_private.keep_flavor_product();

-- 5. VENDAS. Rascunho -> confirmada (baixa estoque) -> entregue.
-- Confirmada -> cancelada devolve estoque UMA vez. Entregue exige devolução manual.
CREATE TABLE public.sales (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  customer_id integer NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_id integer UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  sale_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  customer_name text NOT NULL,
  customer_phone varchar(20) NOT NULL,
  customer_document varchar(14),
  delivery_address jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(delivery_address) = 'object'),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('pix','boleto','cartao_credito','cartao_debito','dinheiro','transferencia')),
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING',
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  status public.sale_status NOT NULL DEFAULT 'DRAFT',
  notes text,
  created_by_id integer NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  CHECK (subtotal >= 0 AND discount >= 0 AND discount <= subtotal AND delivery_fee >= 0 AND total = subtotal - discount + delivery_fee AND total <> 'NaN'::numeric),
  CHECK (paid_amount >= 0 AND paid_amount <= total AND paid_amount <> 'NaN'::numeric),
  CHECK ((payment_status = 'PENDING' AND paid_amount = 0) OR (payment_status = 'PARTIAL' AND paid_amount > 0 AND paid_amount < total) OR (payment_status = 'PAID' AND paid_amount = total))
);
CREATE INDEX sales_customer_date_idx ON public.sales(customer_id, sale_date DESC);
CREATE INDEX sales_admin_idx ON public.sales(created_by_id);
CREATE INDEX sales_status_date_idx ON public.sales(status, sale_date DESC);
CREATE INDEX sales_payment_idx ON public.sales(payment_status) WHERE status IN ('CONFIRMED', 'DELIVERED');

CREATE TABLE public.sale_items (
  id serial PRIMARY KEY,
  sale_id integer NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id integer REFERENCES public.products(id) ON DELETE RESTRICT,
  flavor_id integer REFERENCES public.product_flavors(id) ON DELETE RESTRICT,
  product_name text NOT NULL CHECK (btrim(product_name) <> ''),
  brand text,
  unit text,
  description text,
  flavor_name text,
  notes text,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0 AND quantity <> 'NaN'::numeric),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0 AND unit_price <> 'NaN'::numeric),
  unit_cost numeric(10,2) CHECK (unit_cost >= 0 AND unit_cost <> 'NaN'::numeric),
  subtotal numeric(10,2) NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  CHECK (product_id IS NULL OR quantity = trunc(quantity)),
  CHECK (flavor_id IS NULL OR product_id IS NOT NULL),
  CHECK (subtotal = round(quantity * unit_price, 2) AND subtotal <> 'NaN'::numeric)
);
CREATE INDEX sale_items_sale_idx ON public.sale_items(sale_id);
CREATE INDEX sale_items_product_idx ON public.sale_items(product_id);
CREATE INDEX sale_items_flavor_idx ON public.sale_items(flavor_id);

-- Livro de estoque: saldo anterior + variação = saldo posterior.
CREATE TABLE public.stock_movements (
  id bigserial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sale_id integer REFERENCES public.sales(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('OPENING','ADJUSTMENT','SALE','CANCELLATION')),
  quantity integer NOT NULL CHECK (quantity <> 0),
  stock_before integer NOT NULL CHECK (stock_before >= 0),
  stock_after integer NOT NULL CHECK (stock_after >= 0 AND stock_after = stock_before + quantity),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  created_by_id integer REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  CHECK ((kind IN ('SALE','CANCELLATION') AND sale_id IS NOT NULL) OR (kind IN ('OPENING','ADJUSTMENT') AND sale_id IS NULL)),
  CHECK ((kind <> 'SALE' OR quantity < 0) AND (kind <> 'CANCELLATION' OR quantity > 0))
);
CREATE INDEX stock_movements_product_date_idx ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX stock_movements_admin_idx ON public.stock_movements(created_by_id);
CREATE UNIQUE INDEX stock_movements_sale_once_idx ON public.stock_movements(sale_id, product_id, kind) WHERE sale_id IS NOT NULL;

-- 6. CONTEÚDO EDITORIAL. Não inventa avaliações verificadas a partir de vendas.
CREATE TABLE public.testimonials (
  id serial PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  city text,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text text NOT NULL CHECK (btrim(text) <> ''),
  avatar text,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now())
);
CREATE TABLE public.settings (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE CHECK (btrim(key) <> ''),
  value text NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now()),
  updated_at timestamp(3) NOT NULL DEFAULT timezone('UTC', now())
);

-- 7. REGRAS E TRIGGERS. Funções internas não são endpoints públicos.
CREATE FUNCTION dmais_private.touch_updated_at() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  NEW.updated_at := timezone('UTC', statement_timestamp());
  RETURN NEW;
END;
$$;

CREATE FUNCTION dmais_private.fill_customer_snapshot() RETURNS trigger LANGUAGE plpgsql
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
    IF c.document IS DISTINCT FROM o.document OR c.type <> o.customer_type OR
      (o.customer_id IS NOT NULL AND o.customer_id <> c.id) THEN RAISE EXCEPTION 'Pedido pertence a outro cliente.'; END IF;
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

CREATE FUNCTION dmais_private.customer_code() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := 'CLI-' || lpad(NEW.id::text, greatest(6, length(NEW.id::text)), '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customers_code BEFORE INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION dmais_private.customer_code();
CREATE TRIGGER sales_snapshot BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION dmais_private.fill_customer_snapshot();

-- Solicitações recebem dados oficiais do produto; os textos do navegador não prevalecem.
CREATE FUNCTION dmais_private.prepare_order_item() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE p public.products;
BEGIN
  PERFORM 1 FROM public.orders WHERE id = NEW.order_id AND status = 'REQUESTED' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente pedidos em REQUESTED podem receber itens.'; END IF;
  SELECT * INTO STRICT p FROM public.products WHERE id = NEW.product_id;
  IF NOT p.active OR p.deleted_at IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p.category_id AND active) THEN
    RAISE EXCEPTION 'Produto indisponível.';
  END IF;
  IF NEW.total_quantity < p.min_qty OR NEW.total_quantity > p.stock THEN
    RAISE EXCEPTION 'Quantidade fora do mínimo/estoque para o produto %.', p.id;
  END IF;
  NEW.product_name := p.name; NEW.brand := p.brand; NEW.description := p.description;
  NEW.unit := p.unit; NEW.min_qty := p.min_qty; NEW.unit_price := p.price;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_items_prepare BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION dmais_private.prepare_order_item();

CREATE FUNCTION dmais_private.prepare_order_flavor() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE v_product integer; f public.product_flavors;
BEGIN
  SELECT product_id INTO STRICT v_product FROM public.order_items WHERE id = NEW.order_item_id;
  IF NEW.flavor_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.product_flavors WHERE product_id = v_product) THEN
      RAISE EXCEPTION 'Escolha um sabor ativo deste produto.';
    END IF;
    NEW.flavor_name := NULL;
  ELSE
    SELECT * INTO STRICT f FROM public.product_flavors WHERE id = NEW.flavor_id;
    IF f.product_id <> v_product OR NOT f.active THEN RAISE EXCEPTION 'Sabor não pertence ao produto ou está inativo.'; END IF;
    NEW.flavor_name := f.name;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_flavors_prepare BEFORE INSERT ON public.order_item_flavors FOR EACH ROW EXECUTE FUNCTION dmais_private.prepare_order_flavor();

-- Constraint diferida permite o INSERT aninhado do Prisma e valida tudo no COMMIT.
CREATE FUNCTION dmais_private.check_order_complete() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE v_order integer;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN v_order := NEW.id;
  ELSIF TG_TABLE_NAME = 'order_items' THEN v_order := NEW.order_id;
  ELSE SELECT order_id INTO v_order FROM public.order_items WHERE id = NEW.order_item_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order) THEN RAISE EXCEPTION 'Pedido vazio.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.order_items i LEFT JOIN public.order_item_flavors f ON f.order_item_id = i.id
    WHERE i.order_id = v_order GROUP BY i.id, i.total_quantity
    HAVING coalesce(sum(f.quantity), 0) <> i.total_quantity
  ) THEN RAISE EXCEPTION 'A soma dos sabores deve ser igual à quantidade do item.'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER orders_complete AFTER INSERT ON public.orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dmais_private.check_order_complete();
CREATE CONSTRAINT TRIGGER order_items_complete AFTER INSERT ON public.order_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dmais_private.check_order_complete();
CREATE CONSTRAINT TRIGGER order_flavors_complete AFTER INSERT ON public.order_item_flavors DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dmais_private.check_order_complete();

CREATE FUNCTION dmais_private.immutable_record() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Histórico imutável: registre cancelamento ou uma nova operação.'; END;
$$;
CREATE TRIGGER order_items_history BEFORE UPDATE OR DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION dmais_private.immutable_record();
CREATE TRIGGER order_flavors_history BEFORE UPDATE OR DELETE ON public.order_item_flavors FOR EACH ROW EXECUTE FUNCTION dmais_private.immutable_record();
CREATE TRIGGER movements_history BEFORE UPDATE OR DELETE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION dmais_private.immutable_record();

CREATE FUNCTION dmais_private.guard_order() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'REQUESTED' THEN RAISE EXCEPTION 'Pedido deve iniciar como REQUESTED.'; END IF;
    IF NEW.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND type = NEW.customer_type AND document = NEW.document) THEN
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
  IF NEW.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND type = NEW.customer_type AND document = NEW.document) THEN
    RAISE EXCEPTION 'Cliente e documento da solicitação não correspondem.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_guard BEFORE INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION dmais_private.guard_order();

-- Itens só podem ser editados em rascunho. Preço negociado é permitido ao admin.
CREATE FUNCTION dmais_private.prepare_sale_item() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE v_status text; p public.products; f public.product_flavors; v_parent integer;
BEGIN
  v_parent := CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
  SELECT status::text INTO v_status FROM public.sales WHERE id = v_parent FOR UPDATE;
  IF TG_OP = 'UPDATE' AND NEW.sale_id <> OLD.sale_id THEN RAISE EXCEPTION 'Não mova itens entre vendas.'; END IF;
  IF v_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Itens só podem ser alterados em rascunho.'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.product_id IS NOT NULL THEN
    SELECT * INTO STRICT p FROM public.products WHERE id = NEW.product_id;
    IF NOT p.active OR p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Produto indisponível.'; END IF;
    NEW.product_name := p.name; NEW.brand := p.brand; NEW.unit := p.unit; NEW.description := p.description;
    NEW.unit_cost := p.cost;
  END IF;
  IF NEW.flavor_id IS NOT NULL THEN
    SELECT * INTO STRICT f FROM public.product_flavors WHERE id = NEW.flavor_id;
    IF NEW.product_id IS NULL OR f.product_id <> NEW.product_id OR NOT f.active THEN RAISE EXCEPTION 'Sabor inválido para o produto.'; END IF;
    NEW.flavor_name := f.name;
  ELSE
    NEW.flavor_name := NULL;
  END IF;
  NEW.subtotal := round(NEW.quantity * NEW.unit_price, 2);
  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_items_prepare BEFORE INSERT OR UPDATE OR DELETE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION dmais_private.prepare_sale_item();

-- Totais calculados a partir dos itens; valores enviados pela interface não prevalecem.
CREATE FUNCTION dmais_private.calculate_sale_totals() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  SELECT coalesce(sum(subtotal), 0) INTO NEW.subtotal FROM public.sale_items WHERE sale_id = NEW.id;
  NEW.total := NEW.subtotal - NEW.discount + NEW.delivery_fee;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sales_10_totals BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION dmais_private.calculate_sale_totals();

CREATE FUNCTION dmais_private.refresh_sale_totals() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  UPDATE public.sales SET updated_at = timezone('UTC', now()) WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
  RETURN NULL;
END;
$$;
CREATE TRIGGER sale_items_totals AFTER INSERT OR UPDATE OR DELETE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION dmais_private.refresh_sale_totals();

-- Toda mudança de saldo é auditada, inclusive edição manual do estoque no admin.
-- Contexto da venda é local à transação e definido somente pelo trigger abaixo.
CREATE FUNCTION dmais_private.audit_stock() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE v_before integer := 0; v_sale integer; v_kind text; v_admin integer; v_reason text;
BEGIN
  IF TG_OP = 'UPDATE' THEN v_before := OLD.stock; END IF;
  IF NEW.stock = v_before THEN RETURN NULL; END IF;
  v_sale := nullif(current_setting('dmais.sale_id', true), '')::integer;
  v_admin := nullif(current_setting('dmais.admin_id', true), '')::integer;
  v_kind := nullif(current_setting('dmais.stock_kind', true), '');
  v_reason := nullif(current_setting('dmais.stock_reason', true), '');
  IF v_sale IS NULL THEN v_kind := CASE WHEN TG_OP = 'INSERT' THEN 'OPENING' ELSE 'ADJUSTMENT' END; END IF;
  INSERT INTO public.stock_movements(product_id, sale_id, kind, quantity, stock_before, stock_after, reason, created_by_id)
  VALUES(NEW.id, v_sale, v_kind, NEW.stock - v_before, v_before, NEW.stock,
    coalesce(v_reason, CASE WHEN TG_OP = 'INSERT' THEN 'Saldo inicial' ELSE 'Ajuste de saldo pelo administrador' END), v_admin);
  RETURN NULL;
END;
$$;
CREATE TRIGGER products_stock_audit AFTER INSERT OR UPDATE OF stock ON public.products FOR EACH ROW EXECUTE FUNCTION dmais_private.audit_stock();

CREATE FUNCTION dmais_private.guard_sale() RETURNS trigger LANGUAGE plpgsql
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
        NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND type = o.customer_type AND document = o.document) THEN
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
CREATE TRIGGER sales_20_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION dmais_private.guard_sale();

CREATE FUNCTION dmais_private.link_sale_source() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'DRAFT' AND NEW.status = 'CONFIRMED' THEN
    IF NEW.order_id IS NOT NULL THEN UPDATE public.orders SET status = 'CONFIRMED', customer_id = NEW.customer_id WHERE id = NEW.order_id; END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER sales_source AFTER UPDATE OF status ON public.sales FOR EACH ROW EXECUTE FUNCTION dmais_private.link_sale_source();

-- Wrappers administrativos: uma chamada = uma transação atômica.
CREATE FUNCTION public.confirm_sale(p_sale_id integer) RETURNS public.sales LANGUAGE plpgsql SECURITY INVOKER
SET search_path = '' AS $$
DECLARE s public.sales;
BEGIN
  SELECT * INTO STRICT s FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF s.status IN ('CONFIRMED','DELIVERED') THEN RETURN s; END IF;
  UPDATE public.sales SET status = 'CONFIRMED' WHERE id = p_sale_id RETURNING * INTO s;
  RETURN s;
END;
$$;
CREATE FUNCTION public.cancel_sale(p_sale_id integer) RETURNS public.sales LANGUAGE plpgsql SECURITY INVOKER
SET search_path = '' AS $$
DECLARE s public.sales;
BEGIN
  SELECT * INTO STRICT s FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF s.status = 'CANCELED' THEN RETURN s; END IF;
  UPDATE public.sales SET status = 'CANCELED' WHERE id = p_sale_id RETURNING * INTO s;
  RETURN s;
END;
$$;

CREATE FUNCTION public.adjust_stock(p_product_id integer, p_delta integer, p_admin_id integer, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_stock integer;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 OR p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'Informe variação e motivo do ajuste.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_admin_id AND active) THEN RAISE EXCEPTION 'Administrador inválido.'; END IF;
  PERFORM set_config('dmais.sale_id', '', true);
  PERFORM set_config('dmais.admin_id', p_admin_id::text, true);
  PERFORM set_config('dmais.stock_kind', 'ADJUSTMENT', true);
  PERFORM set_config('dmais.stock_reason', p_reason, true);
  UPDATE public.products SET stock = stock + p_delta WHERE id = p_product_id RETURNING stock INTO STRICT v_stock;
  PERFORM set_config('dmais.admin_id', '', true);
  PERFORM set_config('dmais.stock_kind', '', true);
  PERFORM set_config('dmais.stock_reason', '', true);
  RETURN v_stock;
END;
$$;

-- Timestamps UTC sem fuso mantêm os tipos esperados pelo Prisma atual.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','product_flavors','admin_users','customers','orders','sales','testimonials','settings'] LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION dmais_private.touch_updated_at()', t);
  END LOOP;
END;
$$;

-- 8. CONSULTAS. Invoker evita que views contornem as políticas RLS.
CREATE VIEW public.v_store_products WITH (security_invoker = true) AS
SELECT p.id, p.name, p.brand, p.description, p.image_url, p.category_id, c.name AS category,
  p.price, p.unit, p.min_qty, p.stock, p.stars,
  coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) ORDER BY f.id)
    FROM public.product_flavors f WHERE f.product_id = p.id AND f.active), '[]'::jsonb) AS flavors
FROM public.products p JOIN public.categories c ON c.id = p.category_id
WHERE p.active AND p.deleted_at IS NULL AND c.active;

CREATE VIEW public.v_sales_summary WITH (security_invoker = true) AS
SELECT s.id, s.code, s.customer_id, s.customer_name, s.sale_date, s.status, s.payment_status,
  s.subtotal, s.discount, s.delivery_fee, s.total, s.paid_amount,
  CASE WHEN s.status IN ('CONFIRMED','DELIVERED') THEN s.total - s.paid_amount ELSE 0 END AS pending_amount,
  CASE WHEN s.status = 'DELIVERED' THEN s.subtotal - s.discount ELSE 0 END AS revenue,
  a.units, a.cost_complete,
  CASE WHEN s.status = 'DELIVERED' AND a.cost_complete THEN a.cost END AS cost,
  CASE WHEN s.status = 'DELIVERED' AND a.cost_complete THEN s.subtotal - s.discount - a.cost END AS gross_profit
FROM public.sales s
LEFT JOIN LATERAL (
  SELECT coalesce(sum(i.quantity), 0) AS units, coalesce(bool_and(i.unit_cost IS NOT NULL), false) AS cost_complete,
    sum(i.quantity * i.unit_cost) AS cost FROM public.sale_items i WHERE i.sale_id = s.id
) a ON true;

-- 9. SUPABASE: catálogo público somente para leitura; dados comerciais privados.
-- O JWT próprio do Express NÃO equivale ao Supabase Auth.
-- Admin e gravações passam pelo backend confiável (conexão Postgres/service_role).
DO $$
DECLARE t text; seq text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','product_flavors','admin_users','customers','orders','order_items','order_item_flavors','sales','sale_items','stock_movements','testimonials','settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
    seq := pg_get_serial_sequence('public.' || t, 'id');
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', seq);
  END LOOP;
END;
$$;
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM service_role;
-- O trigger de auditoria precisa inserir como chamador; inserir é permitido ao backend.
GRANT INSERT ON public.stock_movements TO service_role;

GRANT SELECT ON public.categories, public.product_flavors, public.testimonials TO anon, authenticated;
GRANT SELECT (id, name, brand, description, image_url, category_id, price, unit, min_qty, stock, active, stars, deleted_at)
  ON public.products TO anon, authenticated;
CREATE POLICY categories_public_read ON public.categories FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY products_public_read ON public.products FOR SELECT TO anon, authenticated USING (
  active AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.active)
);
CREATE POLICY flavors_public_read ON public.product_flavors FOR SELECT TO anon, authenticated USING (
  active AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.active AND p.deleted_at IS NULL)
);
CREATE POLICY testimonials_public_read ON public.testimonials FOR SELECT TO anon, authenticated USING (published);

REVOKE ALL ON public.v_store_products, public.v_sales_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_store_products TO anon, authenticated, service_role;
GRANT SELECT ON public.v_sales_summary TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dmais_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dmais_private TO service_role;
REVOKE ALL ON FUNCTION public.confirm_sale(integer), public.cancel_sale(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_sale(integer), public.cancel_sale(integer) TO service_role;
REVOKE ALL ON FUNCTION public.adjust_stock(integer, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(integer, integer, integer, text) TO service_role;

COMMENT ON TABLE public.orders IS 'Intenção de compra; não comprova envio no WhatsApp e não reserva estoque.';
COMMENT ON TABLE public.sales IS 'Venda manual: DRAFT -> CONFIRMED baixa estoque; DELIVERED indica entrega/conclusão.';
COMMENT ON TABLE public.stock_movements IS 'Auditoria de saldo. Não editar nem apagar; estornar com nova operação.';
COMMENT ON COLUMN public.products.cost IS 'Custo interno; sem acesso público, inclusive pelo catálogo.';
COMMENT ON COLUMN public.sales.paid_amount IS 'Recebimentos registrados manualmente; não processa pagamentos.';
COMMENT ON COLUMN public.customers.document IS 'Sem pontuação; PF 11 dígitos, PJ 12 alfanuméricos + 2 dígitos. Dígitos verificadores validados na API.';

INSERT INTO public.categories(name, sort_order) VALUES ('Balas',0),('Chocolates',1),('Pirulitos',2),('Gomas',3),('Marshmallow',4),('Drops',5);
INSERT INTO public.settings(key, value) VALUES
  ('company_name', 'D''mais Comercial de Doces'),
  ('whatsapp_number', '5551982092567'),
  ('low_stock_threshold', '10');

COMMIT;
