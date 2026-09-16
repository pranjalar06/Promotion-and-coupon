--
-- PostgreSQL database dump
--
-- Schema-only dump of the PromoStore database. Use this to bootstrap a fresh
-- PostgreSQL database without needing Node/Prisma installed:
--   createdb promo_db
--   psql -d promo_db -f schema.sql
-- This does NOT seed any data — run `npm run seed` (server/prisma/seed.js)
-- afterwards for demo categories/products/promotions/admin account.

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DiscountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DiscountType" AS ENUM (
    'PERCENTAGE',
    'FLAT'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'COMPLETED',
    'FAILED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'SUCCESS',
    'FAILED'
);


--
-- Name: PromotionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PromotionStatus" AS ENUM (
    'ACTIVE',
    'PAUSED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id text NOT NULL,
    cart_id text NOT NULL,
    product_id text NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT cart_items_quantity_positive CHECK ((quantity > 0))
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id text NOT NULL,
    user_id text NOT NULL,
    coupon_code text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    id text NOT NULL,
    key text NOT NULL,
    user_id text NOT NULL,
    order_id text,
    response jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    order_id text NOT NULL,
    product_id text NOT NULL,
    product_name text NOT NULL,
    sku text NOT NULL,
    category_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    final_price numeric(12,2) NOT NULL,
    CONSTRAINT order_items_discount_nonnegative CHECK ((discount >= (0)::numeric)),
    CONSTRAINT order_items_final_price_nonnegative CHECK ((final_price >= (0)::numeric)),
    CONSTRAINT order_items_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT order_items_unit_price_nonnegative CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text NOT NULL,
    user_id text NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) NOT NULL,
    coupon_code text,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_address text NOT NULL,
    status public."OrderStatus" NOT NULL,
    payment_status public."PaymentStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT orders_discount_nonnegative CHECK ((discount >= (0)::numeric)),
    CONSTRAINT orders_subtotal_nonnegative CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT orders_total_nonnegative CHECK ((total >= (0)::numeric))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    price numeric(12,2) NOT NULL,
    image text NOT NULL,
    category_id text NOT NULL,
    stock integer NOT NULL,
    sku text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT products_price_positive CHECK ((price > (0)::numeric)),
    CONSTRAINT products_stock_nonnegative CHECK ((stock >= 0))
);


--
-- Name: promotion_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_categories (
    id text NOT NULL,
    promotion_id text NOT NULL,
    category_id text NOT NULL
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    discount_type public."DiscountType" NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    maximum_discount numeric(12,2),
    minimum_order_value numeric(12,2) DEFAULT 0 NOT NULL,
    applies_to_all_categories boolean DEFAULT true NOT NULL,
    status public."PromotionStatus" DEFAULT 'ACTIVE'::public."PromotionStatus" NOT NULL,
    start_at timestamp(3) without time zone NOT NULL,
    end_at timestamp(3) without time zone NOT NULL,
    total_usage_limit integer,
    per_user_usage_limit integer,
    current_usage integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT promotions_current_usage_nonnegative CHECK ((current_usage >= 0)),
    CONSTRAINT promotions_discount_value_positive CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT promotions_end_after_start CHECK ((end_at > start_at)),
    CONSTRAINT promotions_max_discount_positive CHECK (((maximum_discount IS NULL) OR (maximum_discount > (0)::numeric))),
    CONSTRAINT promotions_min_order_nonnegative CHECK ((minimum_order_value >= (0)::numeric)),
    CONSTRAINT promotions_per_user_usage_limit_nonnegative CHECK (((per_user_usage_limit IS NULL) OR (per_user_usage_limit >= 0))),
    CONSTRAINT promotions_percentage_range CHECK (((NOT (discount_type = 'PERCENTAGE'::public."DiscountType")) OR ((discount_value > (0)::numeric) AND (discount_value <= (100)::numeric)))),
    CONSTRAINT promotions_total_usage_limit_nonnegative CHECK (((total_usage_limit IS NULL) OR (total_usage_limit >= 0)))
);


--
-- Name: redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redemptions (
    id text NOT NULL,
    promotion_id text NOT NULL,
    user_id text NOT NULL,
    order_id text NOT NULL,
    coupon_code text NOT NULL,
    discount_type public."DiscountType" NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT redemptions_discount_amount_nonnegative CHECK ((discount_amount >= (0)::numeric))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promotion_categories promotion_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_categories
    ADD CONSTRAINT promotion_categories_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: redemptions redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: cart_items_cart_id_product_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cart_items_cart_id_product_id_key ON public.cart_items USING btree (cart_id, product_id);


--
-- Name: carts_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX carts_user_id_key ON public.carts USING btree (user_id);


--
-- Name: categories_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);


--
-- Name: idempotency_keys_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idempotency_keys_key_key ON public.idempotency_keys USING btree (key);


--
-- Name: order_items_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);


--
-- Name: orders_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_user_id_idx ON public.orders USING btree (user_id);


--
-- Name: products_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: promotion_categories_promotion_id_category_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX promotion_categories_promotion_id_category_id_key ON public.promotion_categories USING btree (promotion_id, category_id);


--
-- Name: promotions_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX promotions_code_key ON public.promotions USING btree (code);


--
-- Name: redemptions_order_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX redemptions_order_id_key ON public.redemptions USING btree (order_id);


--
-- Name: redemptions_promotion_id_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX redemptions_promotion_id_user_id_idx ON public.redemptions USING btree (promotion_id, user_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: promotion_categories promotion_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_categories
    ADD CONSTRAINT promotion_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: promotion_categories promotion_categories_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_categories
    ADD CONSTRAINT promotion_categories_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: redemptions redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: redemptions redemptions_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: redemptions redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

