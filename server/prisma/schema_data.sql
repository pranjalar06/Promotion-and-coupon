--
-- PostgreSQL database dump
--
-- Full dump (schema + data) of the PromoStore database, as an alternative to
-- schema.sql + npm run seed. Use this to clone the exact current dev database
-- (categories, products, promotions, the admin account, and any orders placed
-- locally) onto a fresh PostgreSQL instance without needing Node/Prisma:
--   createdb promo_db
--   psql -d promo_db -f schema_data.sql
-- Note: user password hashes come along as-is (bcrypt hashes, not plaintext),
-- so seeded/existing accounts keep working; anyone who signed up locally can
-- still log in with their original password on the new database.

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
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cart_items (id, cart_id, product_id, quantity, created_at, updated_at) FROM stdin;
100e2ce6-6542-4954-925f-84aef6c7863e	76323d43-4af2-4eea-93c3-9be80ca3c506	44040a25-92c6-437a-a4c6-3f37b1948b83	1	2026-09-16 19:35:58.286	2026-09-16 19:35:58.286
08958163-1897-4130-956e-3b57868cfa64	76323d43-4af2-4eea-93c3-9be80ca3c506	6b71126e-db7a-4e87-a2c4-fe59a13a7967	1	2026-09-16 19:36:00.081	2026-09-16 19:36:00.081
7ce6508a-962b-4288-a5cc-fdd2122f78a4	76323d43-4af2-4eea-93c3-9be80ca3c506	f5d52fbd-6a74-49e1-b351-9811e3c2eaf6	2	2026-09-16 19:36:12.401	2026-09-16 19:46:19.714
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carts (id, user_id, coupon_code, created_at, updated_at) FROM stdin;
840a50c1-922a-4a06-9b77-4b5b30f2d45b	985770ce-5d92-45f0-9c27-4b06850dac7a	\N	2026-09-16 19:23:18.029	2026-09-16 19:23:18.029
76323d43-4af2-4eea-93c3-9be80ca3c506	48bd6d3d-addf-4d70-a29f-5de09201c273	\N	2026-09-16 19:35:52.807	2026-09-16 19:36:47.878
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, active, created_at, updated_at) FROM stdin;
b63d99cb-52a1-434e-81df-6a4e7de2c283	Electronics	electronics	t	2026-09-16 19:23:17.603	2026-09-16 19:23:17.603
2b3204a6-ac4e-4c7c-becc-a6a7e4d6cec4	Fashion	fashion	t	2026-09-16 19:23:17.623	2026-09-16 19:23:17.623
0dd64cba-6a84-44fc-9fdd-b2a5ecac31ef	Home	home	t	2026-09-16 19:23:17.626	2026-09-16 19:23:17.626
ae54353e-e69f-4aa8-a4b9-28f9f02583bd	Beauty	beauty	t	2026-09-16 19:23:17.628	2026-09-16 19:23:17.628
7dee458d-03d3-4e8a-b668-aa85de72aa2e	Grocery	grocery	t	2026-09-16 19:23:17.631	2026-09-16 19:23:17.631
\.


--
-- Data for Name: idempotency_keys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.idempotency_keys (id, key, user_id, order_id, response, created_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, product_id, product_name, sku, category_name, quantity, unit_price, discount, final_price) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, user_id, subtotal, discount, total, coupon_code, customer_name, customer_email, customer_address, status, payment_status, created_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, description, price, image, category_id, stock, sku, active, created_at, updated_at) FROM stdin;
f5fc839f-5266-4d0a-a5bd-f61ef84c046b	Wireless Optical Mouse	Ergonomic 2.4GHz wireless mouse with adjustable DPI.	699.00	https://picsum.photos/seed/elec1/600/600	b63d99cb-52a1-434e-81df-6a4e7de2c283	60	ELEC-001	t	2026-09-16 19:23:17.636	2026-09-16 19:23:17.636
f5e41ffd-4945-45bc-973e-df69c99572d4	Mechanical Keyboard	RGB backlit mechanical keyboard with blue switches.	2499.00	https://picsum.photos/seed/elec2/600/600	b63d99cb-52a1-434e-81df-6a4e7de2c283	25	ELEC-002	t	2026-09-16 19:23:17.647	2026-09-16 19:23:17.647
dcb1855c-5646-4e87-9386-e42a5d067ed2	Bluetooth Headphones	Over-ear wireless headphones with 30-hour battery life.	3499.00	https://picsum.photos/seed/elec3/600/600	b63d99cb-52a1-434e-81df-6a4e7de2c283	40	ELEC-003	t	2026-09-16 19:23:17.658	2026-09-16 19:23:17.658
3b031205-1cdd-4002-a3e8-93cb0aedeb27	27-inch 4K Monitor	Ultra HD IPS monitor with HDR support.	24999.00	https://picsum.photos/seed/elec4/600/600	b63d99cb-52a1-434e-81df-6a4e7de2c283	12	ELEC-004	t	2026-09-16 19:23:17.664	2026-09-16 19:23:17.664
257ceb50-6393-4400-a476-6ac29f7c50e1	Smartphone 128GB	6.5-inch AMOLED display, triple camera, 128GB storage.	18999.00	https://picsum.photos/seed/elec5/600/600	b63d99cb-52a1-434e-81df-6a4e7de2c283	18	ELEC-005	t	2026-09-16 19:23:17.668	2026-09-16 19:23:17.668
6b71126e-db7a-4e87-a2c4-fe59a13a7967	Portable Power Bank 20000mAh	Fast-charging power bank with dual USB output.	1499.00	https://picsum.photos/seed/elec6/600/600	b63d99cb-52a1-434e-81df-6a4e7de2c283	50	ELEC-006	t	2026-09-16 19:23:17.672	2026-09-16 19:23:17.672
44040a25-92c6-437a-a4c6-3f37b1948b83	Men's Cotton T-Shirt	Breathable 100% cotton crew neck t-shirt.	799.00	https://picsum.photos/seed/fash1/600/600	2b3204a6-ac4e-4c7c-becc-a6a7e4d6cec4	100	FASH-001	t	2026-09-16 19:23:17.675	2026-09-16 19:23:17.675
dd3fcd29-4019-4267-a141-8654cb290b89	Women's Denim Jacket	Classic fit denim jacket with button closure.	2199.00	https://picsum.photos/seed/fash2/600/600	2b3204a6-ac4e-4c7c-becc-a6a7e4d6cec4	35	FASH-002	t	2026-09-16 19:23:17.679	2026-09-16 19:23:17.679
c34f4c0b-4048-40fb-9ef4-f29c2beea996	Running Shoes	Lightweight cushioned running shoes.	3199.00	https://picsum.photos/seed/fash3/600/600	2b3204a6-ac4e-4c7c-becc-a6a7e4d6cec4	45	FASH-003	t	2026-09-16 19:23:17.682	2026-09-16 19:23:17.682
3bff64d0-0435-4215-be37-f167bcd93ccf	Leather Wallet	Genuine leather bifold wallet with card slots.	999.00	https://picsum.photos/seed/fash4/600/600	2b3204a6-ac4e-4c7c-becc-a6a7e4d6cec4	70	FASH-004	t	2026-09-16 19:23:17.685	2026-09-16 19:23:17.685
4d6370fd-8cfc-47c4-9f9c-b34836b675b6	Non-stick Cookware Set	5-piece non-stick cookware set with lids.	3499.00	https://picsum.photos/seed/home1/600/600	0dd64cba-6a84-44fc-9fdd-b2a5ecac31ef	20	HOME-001	t	2026-09-16 19:23:17.689	2026-09-16 19:23:17.689
50d194cc-692d-46db-889f-a90c44c5a801	LED Desk Lamp	Adjustable brightness LED desk lamp with USB port.	899.00	https://picsum.photos/seed/home2/600/600	0dd64cba-6a84-44fc-9fdd-b2a5ecac31ef	55	HOME-002	t	2026-09-16 19:23:17.692	2026-09-16 19:23:17.692
772ba656-7328-4881-a7b8-f58c0df7a702	Cotton Bedsheet Set	King-size cotton bedsheet with two pillow covers.	1299.00	https://picsum.photos/seed/home3/600/600	0dd64cba-6a84-44fc-9fdd-b2a5ecac31ef	40	HOME-003	t	2026-09-16 19:23:17.695	2026-09-16 19:23:17.695
ca526719-7973-4684-8d93-d2a23d77c5d3	Ceramic Dinner Set	16-piece ceramic dinner set for 4.	2799.00	https://picsum.photos/seed/home4/600/600	0dd64cba-6a84-44fc-9fdd-b2a5ecac31ef	15	HOME-004	t	2026-09-16 19:23:17.698	2026-09-16 19:23:17.698
ea617f13-87bb-43b2-9623-2fb097b3b41f	Face Moisturizer 100ml	Lightweight daily moisturizer for all skin types.	499.00	https://picsum.photos/seed/beau1/600/600	ae54353e-e69f-4aa8-a4b9-28f9f02583bd	80	BEAU-001	t	2026-09-16 19:23:17.7	2026-09-16 19:23:17.7
a3b4f710-782d-4b38-b880-1854e298707f	Herbal Shampoo 340ml	Sulfate-free herbal shampoo for daily use.	349.00	https://picsum.photos/seed/beau2/600/600	ae54353e-e69f-4aa8-a4b9-28f9f02583bd	90	BEAU-002	t	2026-09-16 19:23:17.703	2026-09-16 19:23:17.703
8e093853-92d0-45e7-a226-91623100f6bc	Matte Lipstick	Long-lasting matte finish lipstick.	599.00	https://picsum.photos/seed/beau3/600/600	ae54353e-e69f-4aa8-a4b9-28f9f02583bd	65	BEAU-003	t	2026-09-16 19:23:17.708	2026-09-16 19:23:17.708
634b32ec-4fdf-4288-a8db-92a150eea967	Organic Basmati Rice 5kg	Premium aged organic basmati rice.	649.00	https://picsum.photos/seed/groc1/600/600	7dee458d-03d3-4e8a-b668-aa85de72aa2e	30	GROC-001	t	2026-09-16 19:23:17.713	2026-09-16 19:23:17.713
1b962439-054d-4999-9f72-9a75cee1b68d	Cold Pressed Olive Oil 1L	Extra virgin cold pressed olive oil.	899.00	https://picsum.photos/seed/groc2/600/600	7dee458d-03d3-4e8a-b668-aa85de72aa2e	25	GROC-002	t	2026-09-16 19:23:17.716	2026-09-16 19:23:17.716
f5d52fbd-6a74-49e1-b351-9811e3c2eaf6	Assorted Dry Fruits Pack 1kg	Premium mix of almonds, cashews and raisins.	1099.00	https://picsum.photos/seed/groc3/600/600	7dee458d-03d3-4e8a-b668-aa85de72aa2e	20	GROC-003	t	2026-09-16 19:23:17.722	2026-09-16 19:23:17.722
\.


--
-- Data for Name: promotion_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotion_categories (id, promotion_id, category_id) FROM stdin;
b696af71-08ec-445c-8911-bb5a0946bdfa	3359e66d-d467-4237-bc91-8850325b14cf	b63d99cb-52a1-434e-81df-6a4e7de2c283
\.


--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotions (id, code, name, discount_type, discount_value, maximum_discount, minimum_order_value, applies_to_all_categories, status, start_at, end_at, total_usage_limit, per_user_usage_limit, current_usage, created_at, updated_at) FROM stdin;
b33d56f1-b8a7-474a-bde8-6425e805f146	SAVE20	Save 20% Sitewide	PERCENTAGE	20.00	500.00	300.00	t	ACTIVE	2026-08-16 19:23:17.728	2026-10-16 19:23:17.728	100	1	0	2026-09-16 19:23:17.734	2026-09-16 19:23:17.734
3359e66d-d467-4237-bc91-8850325b14cf	TECH20	20% Off Electronics	PERCENTAGE	20.00	1000.00	1000.00	f	ACTIVE	2026-08-16 19:23:17.728	2026-10-16 19:23:17.728	50	1	0	2026-09-16 19:23:17.747	2026-09-16 19:23:17.747
2eeab49f-b8b7-4edd-a972-deabda858de9	FLAT100	Flat ₹100 Off	FLAT	100.00	\N	1000.00	t	ACTIVE	2026-08-16 19:23:17.728	2026-10-16 19:23:17.728	100	\N	0	2026-09-16 19:23:17.761	2026-09-16 19:23:17.761
bd76e16c-08ae-4211-bab9-6131c852808f	EXPIRED20	Expired 20% Promo	PERCENTAGE	20.00	500.00	0.00	t	ACTIVE	2026-07-16 19:23:17.728	2026-09-09 19:23:17.728	\N	\N	0	2026-09-16 19:23:17.766	2026-09-16 19:23:17.766
\.


--
-- Data for Name: redemptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.redemptions (id, promotion_id, user_id, order_id, coupon_code, discount_type, discount_value, discount_amount, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password_hash, role, created_at, updated_at) FROM stdin;
985770ce-5d92-45f0-9c27-4b06850dac7a	Store Admin	admin@promo.test	$2a$10$jVg5v7ifQpJyp8KtGrjbKuI2tVcPLcCXESEQDMIYtbn6l.EBQjAom	ADMIN	2026-09-16 19:23:18.018	2026-09-16 19:23:18.018
48bd6d3d-addf-4d70-a29f-5de09201c273	User1234	user1234@gmail.com	$2a$10$PotuRDVvc9DiYYyxZFZ7u.0VlXTpTwR9gQDHzsysQSl86hYeApQFS	USER	2026-09-16 19:35:52.791	2026-09-16 19:35:52.791
\.


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

