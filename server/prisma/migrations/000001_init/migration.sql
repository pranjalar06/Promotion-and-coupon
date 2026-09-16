-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FLAT');
CREATE TYPE "PromotionStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "OrderStatus" AS ENUM ('COMPLETED', 'FAILED');
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable: categories
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateTable: products
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "image" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_price_positive" CHECK ("price" > 0),
    CONSTRAINT "products_stock_nonnegative" CHECK ("stock" >= 0)
);
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: carts
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coupon_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: cart_items
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: promotions
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "maximum_discount" DECIMAL(12,2),
    "minimum_order_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "applies_to_all_categories" BOOLEAN NOT NULL DEFAULT true,
    "status" "PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "total_usage_limit" INTEGER,
    "per_user_usage_limit" INTEGER,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promotions_discount_value_positive" CHECK ("discount_value" > 0),
    CONSTRAINT "promotions_percentage_range" CHECK (NOT ("discount_type" = 'PERCENTAGE') OR ("discount_value" > 0 AND "discount_value" <= 100)),
    CONSTRAINT "promotions_min_order_nonnegative" CHECK ("minimum_order_value" >= 0),
    CONSTRAINT "promotions_max_discount_positive" CHECK ("maximum_discount" IS NULL OR "maximum_discount" > 0),
    CONSTRAINT "promotions_total_usage_limit_nonnegative" CHECK ("total_usage_limit" IS NULL OR "total_usage_limit" >= 0),
    CONSTRAINT "promotions_per_user_usage_limit_nonnegative" CHECK ("per_user_usage_limit" IS NULL OR "per_user_usage_limit" >= 0),
    CONSTRAINT "promotions_current_usage_nonnegative" CHECK ("current_usage" >= 0),
    CONSTRAINT "promotions_end_after_start" CHECK ("end_at" > "start_at")
);
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateTable: promotion_categories
CREATE TABLE "promotion_categories" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    CONSTRAINT "promotion_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "promotion_categories_promotion_id_category_id_key" ON "promotion_categories"("promotion_id", "category_id");
ALTER TABLE "promotion_categories" ADD CONSTRAINT "promotion_categories_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_categories" ADD CONSTRAINT "promotion_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: orders
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "coupon_code" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_address" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_subtotal_nonnegative" CHECK ("subtotal" >= 0),
    CONSTRAINT "orders_discount_nonnegative" CHECK ("discount" >= 0),
    CONSTRAINT "orders_total_nonnegative" CHECK ("total" >= 0)
);
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: order_items
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_price" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "order_items_unit_price_nonnegative" CHECK ("unit_price" >= 0),
    CONSTRAINT "order_items_discount_nonnegative" CHECK ("discount" >= 0),
    CONSTRAINT "order_items_final_price_nonnegative" CHECK ("final_price" >= 0)
);
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: redemptions
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "coupon_code" TEXT NOT NULL,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "redemptions_discount_amount_nonnegative" CHECK ("discount_amount" >= 0)
);
CREATE UNIQUE INDEX "redemptions_order_id_key" ON "redemptions"("order_id");
CREATE INDEX "redemptions_promotion_id_user_id_idx" ON "redemptions"("promotion_id", "user_id");
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: idempotency_keys
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");
