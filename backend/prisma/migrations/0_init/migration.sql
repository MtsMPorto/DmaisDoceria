-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELED');

-- CreateEnum
CREATE TYPE "sale_status" AS ENUM ('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "category_id" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2),
    "unit" TEXT NOT NULL,
    "unit_description" TEXT,
    "min_qty" INTEGER NOT NULL DEFAULT 1,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stars" INTEGER NOT NULL DEFAULT 5,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_flavors" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "product_flavors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "customer_type" NOT NULL,
    "name" TEXT NOT NULL,
    "trade_name" TEXT,
    "responsible_name" TEXT,
    "document" VARCHAR(14),
    "phone" VARCHAR(20) NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "zip" VARCHAR(8),
    "street" TEXT,
    "street_number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" VARCHAR(2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "request_id" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'REQUESTED',
    "customer_id" INTEGER,
    "customer_type" "customer_type" NOT NULL,
    "customer_name" TEXT NOT NULL,
    "document" VARCHAR(14) NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "zip" VARCHAR(8) NOT NULL,
    "street" TEXT NOT NULL,
    "street_number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2),
    "total_quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_flavors" (
    "id" SERIAL NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "flavor_id" INTEGER,
    "flavor_name" TEXT,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "order_item_flavors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "sale_date" DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date,
    "customer_name" TEXT NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "customer_document" VARCHAR(14),
    "delivery_address" JSONB NOT NULL DEFAULT '{}',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "payment_status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "sale_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "flavor_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "brand" TEXT,
    "unit" TEXT,
    "description" TEXT,
    "flavor_name" TEXT,
    "notes" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sale_id" INTEGER,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "stars" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "avatar" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_store_idx" ON "products"("category_id", "name") WHERE (active AND (deleted_at IS NULL));

-- CreateIndex
CREATE UNIQUE INDEX "product_flavors_product_id_name_key" ON "product_flavors"("product_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_document_key" ON "customers"("document");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "orders_request_id_key" ON "orders"("request_id");

-- CreateIndex
CREATE INDEX "orders_customer_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_date_idx" ON "orders"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "orders_status_date_idx" ON "orders"("status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "order_items_product_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- CreateIndex
CREATE INDEX "order_item_flavors_flavor_idx" ON "order_item_flavors"("flavor_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_flavors_order_item_id_flavor_id_key" ON "order_item_flavors"("order_item_id", "flavor_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_code_key" ON "sales"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_id_key" ON "sales"("order_id");

-- CreateIndex
CREATE INDEX "sales_admin_idx" ON "sales"("created_by_id");

-- CreateIndex
CREATE INDEX "sales_customer_date_idx" ON "sales"("customer_id", "sale_date" DESC);

-- CreateIndex
CREATE INDEX "sales_payment_idx" ON "sales"("payment_status") WHERE (status = ANY (ARRAY['CONFIRMED'::sale_status, 'DELIVERED'::sale_status]));

-- CreateIndex
CREATE INDEX "sales_status_date_idx" ON "sales"("status", "sale_date" DESC);

-- CreateIndex
CREATE INDEX "sale_items_flavor_idx" ON "sale_items"("flavor_id");

-- CreateIndex
CREATE INDEX "sale_items_product_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "stock_movements_admin_idx" ON "stock_movements"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_date_idx" ON "stock_movements"("product_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_sale_once_idx" ON "stock_movements"("sale_id", "product_id", "kind") WHERE (sale_id IS NOT NULL);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_flavors" ADD CONSTRAINT "product_flavors_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item_flavors" ADD CONSTRAINT "order_item_flavors_flavor_id_fkey" FOREIGN KEY ("flavor_id") REFERENCES "product_flavors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item_flavors" ADD CONSTRAINT "order_item_flavors_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_flavor_id_fkey" FOREIGN KEY ("flavor_id") REFERENCES "product_flavors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

