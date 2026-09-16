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
ec7a89e8-6d3d-489e-ba3e-a3f9537dadb8	31425d91-f3fe-49b0-9698-063381ae288d	903f5e0d-877b-47a2-881a-bd05e55f41b9	1	2026-09-16 20:29:25.287	2026-09-16 20:29:25.287
af4f01ed-cc3b-4070-816f-d66404da1205	09b2b8ec-30f6-46d4-947b-d9fe318f104f	903f5e0d-877b-47a2-881a-bd05e55f41b9	1	2026-09-16 20:30:16.649	2026-09-16 20:30:16.649
a5e163ff-a0ae-4d77-af3a-7a213112fe15	8b441bf2-accf-4e85-8b3d-4bbd8df55216	903f5e0d-877b-47a2-881a-bd05e55f41b9	1	2026-09-16 20:31:40.891	2026-09-16 20:31:40.891
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carts (id, user_id, coupon_code, created_at, updated_at) FROM stdin;
ea249ddb-e659-49e9-a719-7c6883ca01f5	d93ae503-07af-4edf-8ce2-ee6ca43e7047	\N	2026-09-16 20:28:58.83	2026-09-16 20:28:58.83
31425d91-f3fe-49b0-9698-063381ae288d	a4d9c8e9-3495-44bd-afa2-2959c3911010	\N	2026-09-16 20:29:25.155	2026-09-16 20:29:25.155
09b2b8ec-30f6-46d4-947b-d9fe318f104f	37c5ea36-f499-4489-86ee-56453514ad8d	SAVE20	2026-09-16 20:30:16.558	2026-09-16 20:30:18.773
8b441bf2-accf-4e85-8b3d-4bbd8df55216	fd5498b3-5ec8-4e8c-83fc-996c8c4bec47	\N	2026-09-16 20:31:40.807	2026-09-16 20:31:40.807
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, active, created_at, updated_at) FROM stdin;
fe7abd4c-2524-40b3-a96f-f7dbde1b76f1	Electronics	electronics	t	2026-09-16 20:28:58.732	2026-09-16 20:28:58.732
272b3d19-adaa-46bd-b206-d5f865a5fb6a	Fashion	fashion	t	2026-09-16 20:28:58.736	2026-09-16 20:28:58.736
b8dfde3b-8ed7-48cb-a2f1-58d4c8f4e0e5	Home	home	t	2026-09-16 20:28:58.737	2026-09-16 20:28:58.737
5aa3272c-e9f0-4ebb-9da3-f69355f5e18d	Beauty	beauty	t	2026-09-16 20:28:58.737	2026-09-16 20:28:58.737
e7493b47-28e0-488f-b3c0-114112736882	Grocery	grocery	t	2026-09-16 20:28:58.738	2026-09-16 20:28:58.738
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
dcbee50e-bc89-4dc9-85e5-5f01a83604a7	Wireless Optical Mouse	Ergonomic 2.4GHz wireless mouse with adjustable DPI.	35.00	https://picsum.photos/seed/elec1/600/600	fe7abd4c-2524-40b3-a96f-f7dbde1b76f1	60	ELEC-001	t	2026-09-16 20:28:58.739	2026-09-16 20:28:58.739
aef95862-ea09-46dd-b73f-6bb628c5d28a	Mechanical Keyboard	RGB backlit mechanical keyboard with blue switches.	120.00	https://picsum.photos/seed/elec2/600/600	fe7abd4c-2524-40b3-a96f-f7dbde1b76f1	25	ELEC-002	t	2026-09-16 20:28:58.744	2026-09-16 20:28:58.744
67ab0332-65f8-4081-9d97-92d0bd4fdef0	Bluetooth Headphones	Over-ear wireless headphones with 30-hour battery life.	160.00	https://picsum.photos/seed/elec3/600/600	fe7abd4c-2524-40b3-a96f-f7dbde1b76f1	40	ELEC-003	t	2026-09-16 20:28:58.745	2026-09-16 20:28:58.745
f6031c2f-b39a-4d40-9645-6af82044b9fe	27-inch 4K Monitor	Ultra HD IPS monitor with HDR support.	1100.00	https://picsum.photos/seed/elec4/600/600	fe7abd4c-2524-40b3-a96f-f7dbde1b76f1	12	ELEC-004	t	2026-09-16 20:28:58.746	2026-09-16 20:28:58.746
8f937cbe-4fe3-4504-8ae9-229f4b281092	Smartphone 128GB	6.5-inch AMOLED display, triple camera, 128GB storage.	850.00	https://picsum.photos/seed/elec5/600/600	fe7abd4c-2524-40b3-a96f-f7dbde1b76f1	18	ELEC-005	t	2026-09-16 20:28:58.747	2026-09-16 20:28:58.747
4a409812-82de-457b-a667-07614f1f561c	Portable Power Bank 20000mAh	Fast-charging power bank with dual USB output.	70.00	https://picsum.photos/seed/elec6/600/600	fe7abd4c-2524-40b3-a96f-f7dbde1b76f1	50	ELEC-006	t	2026-09-16 20:28:58.747	2026-09-16 20:28:58.747
4189b2d0-998e-4a8d-91ec-c92dd754241f	Men's Cotton T-Shirt	Breathable 100% cotton crew neck t-shirt.	40.00	https://picsum.photos/seed/fash1/600/600	272b3d19-adaa-46bd-b206-d5f865a5fb6a	100	FASH-001	t	2026-09-16 20:28:58.748	2026-09-16 20:28:58.748
87012b61-328b-4222-9e4b-66b4d58a58f9	Women's Denim Jacket	Classic fit denim jacket with button closure.	110.00	https://picsum.photos/seed/fash2/600/600	272b3d19-adaa-46bd-b206-d5f865a5fb6a	35	FASH-002	t	2026-09-16 20:28:58.749	2026-09-16 20:28:58.749
424c7c6b-7b27-415f-8659-463a5a17279c	Running Shoes	Lightweight cushioned running shoes.	150.00	https://picsum.photos/seed/fash3/600/600	272b3d19-adaa-46bd-b206-d5f865a5fb6a	45	FASH-003	t	2026-09-16 20:28:58.749	2026-09-16 20:28:58.749
badbe8b2-3036-467a-8503-0b979789f918	Leather Wallet	Genuine leather bifold wallet with card slots.	50.00	https://picsum.photos/seed/fash4/600/600	272b3d19-adaa-46bd-b206-d5f865a5fb6a	70	FASH-004	t	2026-09-16 20:28:58.75	2026-09-16 20:28:58.75
60e41ae0-e5e0-42fb-8437-77ea1fe7fa17	Non-stick Cookware Set	5-piece non-stick cookware set with lids.	160.00	https://picsum.photos/seed/home1/600/600	b8dfde3b-8ed7-48cb-a2f1-58d4c8f4e0e5	20	HOME-001	t	2026-09-16 20:28:58.751	2026-09-16 20:28:58.751
7b42f485-14bf-49b3-b211-12677f22db10	LED Desk Lamp	Adjustable brightness LED desk lamp with USB port.	45.00	https://picsum.photos/seed/home2/600/600	b8dfde3b-8ed7-48cb-a2f1-58d4c8f4e0e5	55	HOME-002	t	2026-09-16 20:28:58.751	2026-09-16 20:28:58.751
2737903f-79bf-436f-a671-fdacd4041f77	Cotton Bedsheet Set	King-size cotton bedsheet with two pillow covers.	65.00	https://picsum.photos/seed/home3/600/600	b8dfde3b-8ed7-48cb-a2f1-58d4c8f4e0e5	40	HOME-003	t	2026-09-16 20:28:58.752	2026-09-16 20:28:58.752
8124728c-9f26-4c4c-b826-419f51cfe3e1	Ceramic Dinner Set	16-piece ceramic dinner set for 4.	130.00	https://picsum.photos/seed/home4/600/600	b8dfde3b-8ed7-48cb-a2f1-58d4c8f4e0e5	15	HOME-004	t	2026-09-16 20:28:58.752	2026-09-16 20:28:58.752
c992fdbb-aa95-4989-a723-8e0faedec402	Face Moisturizer 100ml	Lightweight daily moisturizer for all skin types.	25.00	https://picsum.photos/seed/beau1/600/600	5aa3272c-e9f0-4ebb-9da3-f69355f5e18d	80	BEAU-001	t	2026-09-16 20:28:58.753	2026-09-16 20:28:58.753
4c679ceb-2962-4dc3-a36d-d011c3ef549d	Herbal Shampoo 340ml	Sulfate-free herbal shampoo for daily use.	18.00	https://picsum.photos/seed/beau2/600/600	5aa3272c-e9f0-4ebb-9da3-f69355f5e18d	90	BEAU-002	t	2026-09-16 20:28:58.754	2026-09-16 20:28:58.754
225a8e7b-7f7e-4cf7-bc8d-f3e3b6699840	Matte Lipstick	Long-lasting matte finish lipstick.	30.00	https://picsum.photos/seed/beau3/600/600	5aa3272c-e9f0-4ebb-9da3-f69355f5e18d	65	BEAU-003	t	2026-09-16 20:28:58.754	2026-09-16 20:28:58.754
77a84390-d2e3-4970-b706-67e2a7b63a31	Organic Basmati Rice 5kg	Premium aged organic basmati rice.	32.00	https://picsum.photos/seed/groc1/600/600	e7493b47-28e0-488f-b3c0-114112736882	30	GROC-001	t	2026-09-16 20:28:58.755	2026-09-16 20:28:58.755
89f9ba82-99f1-42ae-885e-f5fec11e8fa3	Cold Pressed Olive Oil 1L	Extra virgin cold pressed olive oil.	45.00	https://picsum.photos/seed/groc2/600/600	e7493b47-28e0-488f-b3c0-114112736882	25	GROC-002	t	2026-09-16 20:28:58.756	2026-09-16 20:28:58.756
903f5e0d-877b-47a2-881a-bd05e55f41b9	Assorted Dry Fruits Pack 1kg	Premium mix of almonds, cashews and raisins.	55.00	https://picsum.photos/seed/groc3/600/600	e7493b47-28e0-488f-b3c0-114112736882	20	GROC-003	t	2026-09-16 20:28:58.757	2026-09-16 20:28:58.757
\.


--
-- Data for Name: promotion_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotion_categories (id, promotion_id, category_id) FROM stdin;
3b598797-7e02-405c-bc23-016ca339c369	b5893a08-d378-4749-86b3-eab0aa1ce3c5	fe7abd4c-2524-40b3-a96f-f7dbde1b76f1
\.


--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotions (id, code, name, discount_type, discount_value, maximum_discount, minimum_order_value, applies_to_all_categories, status, start_at, end_at, total_usage_limit, per_user_usage_limit, current_usage, created_at, updated_at) FROM stdin;
3b67b604-849e-4a0d-9480-26962f8531a2	SAVE20	Save 20% Sitewide	PERCENTAGE	20.00	75.00	50.00	t	ACTIVE	2026-08-16 20:28:58.754	2026-10-16 20:28:58.754	100	1	0	2026-09-16 20:28:58.758	2026-09-16 20:28:58.758
b5893a08-d378-4749-86b3-eab0aa1ce3c5	TECH20	20% Off Electronics	PERCENTAGE	20.00	150.00	150.00	f	ACTIVE	2026-08-16 20:28:58.754	2026-10-16 20:28:58.754	50	1	0	2026-09-16 20:28:58.762	2026-09-16 20:28:58.762
85318047-9d1a-4374-8590-20fae96fda8b	FLAT15	Flat AED 15 Off	FLAT	15.00	\N	150.00	t	ACTIVE	2026-08-16 20:28:58.754	2026-10-16 20:28:58.754	100	\N	0	2026-09-16 20:28:58.766	2026-09-16 20:28:58.766
4fe32f15-6bb9-4255-ae1b-ba240c4fc44f	EXPIRED20	Expired 20% Promo	PERCENTAGE	20.00	75.00	0.00	t	ACTIVE	2026-07-16 20:28:58.754	2026-09-09 20:28:58.754	\N	\N	0	2026-09-16 20:28:58.767	2026-09-16 20:28:58.767
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
d93ae503-07af-4edf-8ce2-ee6ca43e7047	Store Admin	admin@promo.test	$2a$10$UDvMJV461SpcYatfpp5o5eyfif44T8slqZnJvZciOnEnbVOwO8.Hi	ADMIN	2026-09-16 20:28:58.827	2026-09-16 20:28:58.827
a4d9c8e9-3495-44bd-afa2-2959c3911010	Verify AED User	verifyaed1789590564877@test.com	$2a$10$oJRU3GgzFYa5LxpmXje8fuY1bFx21s8C6q7Zy5Hm3/AcIIe3IHdvi	USER	2026-09-16 20:29:25.154	2026-09-16 20:29:25.154
37c5ea36-f499-4489-86ee-56453514ad8d	Verify AED User	verifyaed1789590616273@test.com	$2a$10$vjUsDVKWiHgYcPwyXUylLeq4aRtr9WwnDvxJnP6mtQbqFCXRTpaam	USER	2026-09-16 20:30:16.555	2026-09-16 20:30:16.555
fd5498b3-5ec8-4e8c-83fc-996c8c4bec47	Badge Test User	badgetest1789590700581@test.com	$2a$10$23ip9W65ZCUnna3BkaGJMOLXgITSyqBC4MT6YUEqMrorjE6Ry8QVa	USER	2026-09-16 20:31:40.806	2026-09-16 20:31:40.806
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


