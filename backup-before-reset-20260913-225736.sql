--
-- PostgreSQL database dump
--

\restrict mF8BlflADpIaf5coKCCBv9abToPJO7sTHMkpizQQQyXGJEFwQcN5jv2ie6JPqDS

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: EntityStatus; Type: TYPE; Schema: public; Owner: debtflow
--

CREATE TYPE public."EntityStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."EntityStatus" OWNER TO debtflow;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: debtflow
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'RECEIVED',
    'PAID'
);


ALTER TYPE public."OrderStatus" OWNER TO debtflow;

--
-- Name: PaymentDirection; Type: TYPE; Schema: public; Owner: debtflow
--

CREATE TYPE public."PaymentDirection" AS ENUM (
    'PAYABLE',
    'RECEIVABLE'
);


ALTER TYPE public."PaymentDirection" OWNER TO debtflow;

--
-- Name: ReceiptStatus; Type: TYPE; Schema: public; Owner: debtflow
--

CREATE TYPE public."ReceiptStatus" AS ENUM (
    'DRAFT',
    'CONFIRMED'
);


ALTER TYPE public."ReceiptStatus" OWNER TO debtflow;

--
-- Name: RecordStatus; Type: TYPE; Schema: public; Owner: debtflow
--

CREATE TYPE public."RecordStatus" AS ENUM (
    'ACTIVE',
    'CANCELLED'
);


ALTER TYPE public."RecordStatus" OWNER TO debtflow;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: debtflow
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'STAFF'
);


ALTER TYPE public."UserRole" OWNER TO debtflow;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO debtflow;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "time" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    detail text
);


ALTER TABLE public.audit_logs OWNER TO debtflow;

--
-- Name: facilities; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.facilities (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    address text,
    status public."EntityStatus" DEFAULT 'ACTIVE'::public."EntityStatus" NOT NULL
);


ALTER TABLE public.facilities OWNER TO debtflow;

--
-- Name: inventory_issues; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.inventory_issues (
    id text NOT NULL,
    issue_code text NOT NULL,
    facility_id text NOT NULL,
    issue_date timestamp(3) without time zone NOT NULL,
    note text,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cancelled_by text,
    cancelled_at timestamp(3) without time zone
);


ALTER TABLE public.inventory_issues OWNER TO debtflow;

--
-- Name: issue_items; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.issue_items (
    id text NOT NULL,
    issue_id text NOT NULL,
    item_name text NOT NULL,
    unit text NOT NULL,
    quantity numeric(14,3) DEFAULT 0 NOT NULL
);


ALTER TABLE public.issue_items OWNER TO debtflow;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    order_id text NOT NULL,
    product_id text,
    name text NOT NULL,
    unit text NOT NULL,
    unit_price numeric(18,2) DEFAULT 0 NOT NULL,
    quantity numeric(14,3) DEFAULT 0 NOT NULL
);


ALTER TABLE public.order_items OWNER TO debtflow;

--
-- Name: payables; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.payables (
    id text NOT NULL,
    invoice_code text NOT NULL,
    supplier_id text NOT NULL,
    purchase_receipt_id text,
    invoice_date timestamp(3) without time zone NOT NULL,
    due_date timestamp(3) without time zone,
    total_amount numeric(18,2) DEFAULT 0 NOT NULL,
    description text,
    note text,
    created_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone,
    deleted_by text
);


ALTER TABLE public.payables OWNER TO debtflow;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.payments (
    id text NOT NULL,
    direction public."PaymentDirection" DEFAULT 'PAYABLE'::public."PaymentDirection" NOT NULL,
    payable_id text NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    payment_date timestamp(3) without time zone NOT NULL,
    payment_method text,
    transaction_code text,
    note text,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cancelled_by text,
    cancelled_at timestamp(3) without time zone,
    proof_url text
);


ALTER TABLE public.payments OWNER TO debtflow;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.purchase_orders (
    id text NOT NULL,
    order_code text NOT NULL,
    supplier_id text NOT NULL,
    facility_id text NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    note text,
    expected_date timestamp(3) without time zone,
    created_by text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp(3) without time zone,
    reject_reason text,
    result_receipt_id text,
    result_payable_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    paid_at timestamp(3) without time zone,
    paid_by text,
    received_at timestamp(3) without time zone,
    received_by text,
    deleted_at timestamp(3) without time zone,
    deleted_by text
);


ALTER TABLE public.purchase_orders OWNER TO debtflow;

--
-- Name: purchase_receipts; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.purchase_receipts (
    id text NOT NULL,
    receipt_code text NOT NULL,
    supplier_id text NOT NULL,
    facility_id text NOT NULL,
    supplier_invoice_code text,
    receipt_date timestamp(3) without time zone NOT NULL,
    due_date timestamp(3) without time zone,
    status public."ReceiptStatus" DEFAULT 'DRAFT'::public."ReceiptStatus" NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    note text,
    created_by text NOT NULL,
    confirmed_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone,
    deleted_by text
);


ALTER TABLE public.purchase_receipts OWNER TO debtflow;

--
-- Name: receipt_items; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.receipt_items (
    id text NOT NULL,
    receipt_id text NOT NULL,
    item_name text NOT NULL,
    unit text NOT NULL,
    quantity numeric(14,3) DEFAULT 0 NOT NULL,
    unit_price numeric(18,2) DEFAULT 0 NOT NULL,
    note text
);


ALTER TABLE public.receipt_items OWNER TO debtflow;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.settings (
    id integer DEFAULT 1 NOT NULL,
    warning_days integer DEFAULT 7 NOT NULL,
    critical_warning_days integer DEFAULT 3 NOT NULL,
    currency text DEFAULT 'VND'::text NOT NULL,
    timezone text DEFAULT 'Asia/Ho_Chi_Minh'::text NOT NULL
);


ALTER TABLE public.settings OWNER TO debtflow;

--
-- Name: staff_permissions; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.staff_permissions (
    id text NOT NULL,
    user_id text NOT NULL,
    module text NOT NULL,
    action text NOT NULL,
    allowed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.staff_permissions OWNER TO debtflow;

--
-- Name: supplier_product_price_history; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.supplier_product_price_history (
    id text NOT NULL,
    supplier_product_id text NOT NULL,
    old_price numeric(18,2) DEFAULT 0 NOT NULL,
    new_price numeric(18,2) DEFAULT 0 NOT NULL,
    source text NOT NULL,
    changed_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.supplier_product_price_history OWNER TO debtflow;

--
-- Name: supplier_products; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.supplier_products (
    id text NOT NULL,
    supplier_id text NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    price numeric(18,2) DEFAULT 0 NOT NULL,
    status public."EntityStatus" DEFAULT 'ACTIVE'::public."EntityStatus" NOT NULL,
    note text
);


ALTER TABLE public.supplier_products OWNER TO debtflow;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    tax_code text,
    contact_person text,
    address text,
    note text,
    status public."EntityStatus" DEFAULT 'ACTIVE'::public."EntityStatus" NOT NULL,
    bank_account_name text,
    bank_account_no text,
    bank_name text,
    qr_code_url text
);


ALTER TABLE public.suppliers OWNER TO debtflow;

--
-- Name: users; Type: TABLE; Schema: public; Owner: debtflow
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public."UserRole" DEFAULT 'STAFF'::public."UserRole" NOT NULL,
    status public."EntityStatus" DEFAULT 'ACTIVE'::public."EntityStatus" NOT NULL,
    last_login_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.users OWNER TO debtflow;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
58645a8f-d0a2-4be0-922b-e590b558dc41	0832849cfe9851a8ec626154f6c6a1839f295fede370f0fae02e0bc118b179d5	2026-08-23 07:47:03.289043+00	20260821133647_init	\N	\N	2026-08-23 07:47:03.188878+00	1
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.audit_logs (id, "time", user_id, action, entity_type, entity_id, detail) FROM stdin;
cmtva27ur0000d6fhivno3huj	2026-09-10 08:40:48.963	admin-nguyenanhson	LOGIN	AUTH	admin-nguyenanhson	Đăng nhập hệ thống
cmtva6i650002d6fhv5pne1uj	2026-09-10 08:44:08.958	admin-nguyenanhson	CREATE_FACILITY	FACILITY	cmtva6i630001d6fhpljfo3oh	Tạo cơ sở cs01 — OCP1
cmtva71xs0004d6fhxw9xq7t7	2026-09-10 08:44:34.576	admin-nguyenanhson	CREATE_FACILITY	FACILITY	cmtva71xq0003d6fhp6inwvoz	Tạo cơ sở cs02 — A6 bt5 cvc
cmtva7lxt0006d6fhy1wwymuz	2026-09-10 08:45:00.498	admin-nguyenanhson	CREATE_FACILITY	FACILITY	cmtva7lxr0005d6fh1c9lbyo0	Tạo cơ sở cs03 — A3 VINHOMES GARDENIA
cmtva7nqi0007d6fhxd7wc2ac	2026-09-10 08:45:02.827	admin-nguyenanhson	UPDATE_SETTINGS	SETTINGS	1	Cập nhật cấu hình: {"warningDays":7,"criticalWarningDays":3,"currency":"VND"}
cmtyedlao0004d601cv2oayyy	2026-09-12 13:04:56.592	admin-nguyenanhson	CREATE_ORDER	ORDER	cmtyedla90001d601g4h4b1u5	Tạo đơn DH-2026-001 (2 dòng)
cmtyg7zr20000d6av4kw34ymo	2026-09-12 13:56:34.622	admin-nguyenanhson	UPDATE_PRODUCT	PRODUCT	cmt8ve6tg0025d6zcrwwd1gry	Cập nhật mặt hàng "Bate mít"
cmtyg85lq0001d6avjc3uwkya	2026-09-12 13:56:42.206	admin-nguyenanhson	CANCEL_ORDER	ORDER	cmtyedla90001d601g4h4b1u5	Huỷ đơn DH-2026-001
cmtyg8kw60006d6avk9thx5c5	2026-09-12 13:57:02.022	admin-nguyenanhson	CREATE_ORDER	ORDER	cmtyg8kvw0003d6avnf4z1v1e	Tạo đơn DH-2026-002 (2 dòng)
cmtyg8vkr0007d6avifxmldb3	2026-09-12 13:57:15.867	admin-nguyenanhson	APPROVE_ORDER	ORDER	cmtyg8kvw0003d6avnf4z1v1e	Duyệt đơn DH-2026-002
cmtygi5w3000ad6avl4smkrjt	2026-09-12 14:04:29.14	admin-nguyenanhson	UPDATE_ORDER	ORDER	cmtyg8kvw0003d6avnf4z1v1e	Chỉnh sửa đơn DH-2026-002 (APPROVED) -> 2 dòng, tổng tiền mới: 132.000đ
cmtygi5xt000hd6avxx17rhih	2026-09-12 14:04:29.202	admin-nguyenanhson	RECEIVE_ORDER	ORDER	cmtyg8kvw0003d6avnf4z1v1e	Nhận hàng đơn DH-2026-002 → phiếu nhập PN-2026-001 + công nợ 132.000đ
cmtygimqt000kd6av1x71e5kj	2026-09-12 14:04:50.981	admin-nguyenanhson	PAY_ORDER	ORDER	cmtyg8kvw0003d6avnf4z1v1e	Thanh toán trọn đơn DH-2026-002: 132.000đ
cmtygrswg0004d69zek503ihn	2026-09-12 14:11:58.864	admin-nguyenanhson	CREATE_ORDER	ORDER	cmtygrsw90001d69zuzy0q9e4	Tạo đơn DH-2026-003 (2 dòng)
cmtygsdfd0009d69zs5h2t1p6	2026-09-12 14:12:25.465	admin-nguyenanhson	CREATE_ORDER	ORDER	cmtygsdeu0006d69zgxnrixhi	Tạo đơn DH-2026-004 (2 dòng)
cmtygt4o0000fd69zzny7j7f4	2026-09-12 14:13:00.769	admin-nguyenanhson	CREATE_ORDER	ORDER	cmtygt4nh000bd69zv60xj3tx	Tạo đơn DH-2026-005 (3 dòng)
cmtygth9y000id69zqh61bvzf	2026-09-12 14:13:17.11	admin-nguyenanhson	UPDATE_ORDER	ORDER	cmtygrsw90001d69zuzy0q9e4	Chỉnh sửa đơn DH-2026-003 (PENDING) -> 2 dòng, tổng tiền mới: 5.240đ
cmtygthax000jd69z68ulfs37	2026-09-12 14:13:17.146	admin-nguyenanhson	APPROVE_ORDER	ORDER	cmtygrsw90001d69zuzy0q9e4	Duyệt đơn DH-2026-003
cmtygtl59000qd69zc85u0uew	2026-09-12 14:13:22.125	admin-nguyenanhson	RECEIVE_ORDER	ORDER	cmtygrsw90001d69zuzy0q9e4	Nhận hàng đơn DH-2026-003 → phiếu nhập PN-2026-002 + công nợ 5.240đ
cmtygu4cp000td69z2htssiaf	2026-09-12 14:13:47.018	admin-nguyenanhson	UPDATE_ORDER	ORDER	cmtygsdeu0006d69zgxnrixhi	Chỉnh sửa đơn DH-2026-004 (PENDING) -> 2 dòng, tổng tiền mới: 114.808đ
cmtygu4dx000ud69zoh8k6r9p	2026-09-12 14:13:47.062	admin-nguyenanhson	APPROVE_ORDER	ORDER	cmtygsdeu0006d69zgxnrixhi	Duyệt đơn DH-2026-004
cmtyh2aqc000yd69zp13imzwj	2026-09-12 14:20:08.533	admin-nguyenanhson	UPDATE_ORDER	ORDER	cmtygt4nh000bd69zv60xj3tx	Chỉnh sửa đơn DH-2026-005 (PENDING) -> 3 dòng, tổng tiền mới: 32.796đ
cmtyh3kc20012d69zy8m062h4	2026-09-12 14:21:07.634	admin-nguyenanhson	UPDATE_ORDER	ORDER	cmtygt4nh000bd69zv60xj3tx	Chỉnh sửa đơn DH-2026-005 (PENDING) -> 3 dòng, tổng tiền mới: 14.808đ
cmtyj8f3q0017d69zsb91k61j	2026-09-12 15:20:53.366	admin-nguyenanhson	CREATE_ORDER	ORDER	cmtyj8f3c0014d69zxasdqssj	Tạo đơn DH-2026-006 (2 dòng)
cmtyj8un40018d69z27gug5mn	2026-09-12 15:21:13.505	admin-nguyenanhson	APPROVE_ORDER	ORDER	cmtyj8f3c0014d69zxasdqssj	Duyệt đơn DH-2026-006
cmtyj955x001bd69zd6emi6po	2026-09-12 15:21:27.142	admin-nguyenanhson	UPDATE_ORDER	ORDER	cmtyj8f3c0014d69zxasdqssj	Chỉnh sửa đơn DH-2026-006 (APPROVED) -> 2 dòng, tổng tiền mới: 144.000đ
cmtyj9580001id69z67q2ov4b	2026-09-12 15:21:27.216	admin-nguyenanhson	RECEIVE_ORDER	ORDER	cmtyj8f3c0014d69zxasdqssj	Nhận hàng đơn DH-2026-006 → phiếu nhập PN-2026-003 + công nợ 144.000đ
cmtzyldip0003d6txrwis7oyq	2026-09-13 15:18:38.258	admin-nguyenanhson	CREATE_USER	USER	cmtzyldib0000d6txboz9wv5h	Tạo user test1@gmail.comte (STAFF)
cmtzz6y1o000ld6uo2nkivaw0	2026-09-13 15:35:24.637	admin-nguyenanhson	SET_PERMISSIONS	USER	cmtzyldib0000d6txboz9wv5h	Cập nhật phân quyền cho test1@gmail.comte (2 quyền)
cmtzzoj2d000md6uomq2bxbvy	2026-09-13 15:49:05.03	cmtzyldib0000d6txboz9wv5h	LOGIN	AUTH	cmtzyldib0000d6txboz9wv5h	Đăng nhập hệ thống
\.


--
-- Data for Name: facilities; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.facilities (id, code, name, address, status) FROM stdin;
cmtva6i630001d6fhpljfo3oh	cs01	OCP1		ACTIVE
cmtva71xq0003d6fhp6inwvoz	cs02	A6 bt5 cvc		ACTIVE
cmtva7lxr0005d6fh1c9lbyo0	cs03	A3 VINHOMES GARDENIA		ACTIVE
\.


--
-- Data for Name: inventory_issues; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.inventory_issues (id, issue_code, facility_id, issue_date, note, status, created_by, created_at, cancelled_by, cancelled_at) FROM stdin;
\.


--
-- Data for Name: issue_items; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.issue_items (id, issue_id, item_name, unit, quantity) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.order_items (id, order_id, product_id, name, unit, unit_price, quantity) FROM stdin;
cmtyedla90002d601hg06wb02	cmtyedla90001d601g4h4b1u5	cmt8ve6tr003zd6zcma9j52ul	Chả Quế Chay	túi	0.00	2.000
cmtyedla90003d601520mlngs	cmtyedla90001d601g4h4b1u5	cmt8ve6tr0040d6zc1hoqh3ca	Chả Bao Xả	túi	0.00	21.000
cmtygi5vc0008d6av0rrk26t6	cmtyg8kvw0003d6avnf4z1v1e	cmt8ve6tr0040d6zc1hoqh3ca	Chả Bao Xả	túi	12000.00	11.000
cmtygi5vc0009d6avdtgebplp	cmtyg8kvw0003d6avnf4z1v1e	cmt8ve6tr003xd6zcq9x1pdi8	Bột Ngọt Gà	túi	0.00	12.000
cmtygth9g000gd69zqcm2pvd9	cmtygrsw90001d69zuzy0q9e4	cmt8ve6tg001wd6zcus6sd5n1	Cốt Lẩu Nấm	Kg	1000.00	1.000
cmtygth9g000hd69zila3oyc5	cmtygrsw90001d69zuzy0q9e4	cmt8ve6tg0023d6zcilp5eelf	Mọc Chay	kg	2120.00	2.000
cmtygu4cd000rd69zzt310d6c	cmtygsdeu0006d69zgxnrixhi	cmt8ve6tg0025d6zcrwwd1gry	Bate mít	hộp	1234.00	12.000
cmtygu4cd000sd69zajsby1zo	cmtygsdeu0006d69zgxnrixhi	cmt8ve6tg0020d6zcg0mg2j7t	BB Bí Đỏ	khay	10000.00	10.000
cmtyh3kbw000zd69zl6azvuxz	cmtygt4nh000bd69zv60xj3tx	cmt8ve6tg0025d6zcrwwd1gry	Bate mít	hộp	1234.00	12.000
cmtyh3kbw0010d69zo5xcg8u8	cmtygt4nh000bd69zv60xj3tx	cmt8ve6tg0020d6zcg0mg2j7t	BB Bí Đỏ	khay	0.00	11.000
cmtyh3kbw0011d69zb50sc3kh	cmtygt4nh000bd69zv60xj3tx	cmt8ve6tg001wd6zcus6sd5n1	Cốt Lẩu Nấm	Kg	0.00	12.000
cmtyj955k0019d69z0e3jk51t	cmtyj8f3c0014d69zxasdqssj	cmt8ve6tr003xd6zcq9x1pdi8	Bột Ngọt Gà	túi	1000.00	12.000
cmtyj955k001ad69zp57rpm3r	cmtyj8f3c0014d69zxasdqssj	cmt8ve6tr0040d6zc1hoqh3ca	Chả Bao Xả	túi	12000.00	11.000
\.


--
-- Data for Name: payables; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.payables (id, invoice_code, supplier_id, purchase_receipt_id, invoice_date, due_date, total_amount, description, note, created_by, created_at, deleted_at, deleted_by) FROM stdin;
cmtygi5xl000gd6avanargfvt	PN-2026-001	cmt8ve6tr003pd6zctk223y7u	cmtygi5xb000cd6av9k2j0nkc	2026-09-12 14:04:29.176	2026-10-12 00:00:00	132000.00	Công nợ từ đơn DH-2026-002	\N	admin-nguyenanhson	2026-09-12 14:04:29.193	\N	\N
cmtygtl4x000pd69zkkkvo2ws	PN-2026-002	cmt8ve6tg001sd6zcxmfo17sp	cmtygtl4q000ld69z2fm1nkme	2026-09-12 14:13:22.102	2026-10-12 00:00:00	5240.00	Công nợ từ đơn DH-2026-003	\N	admin-nguyenanhson	2026-09-12 14:13:22.113	\N	\N
cmtyj957p001hd69zh5d91mub	PN-2026-003	cmt8ve6tr003pd6zctk223y7u	cmtyj957h001dd69z8yo2p79l	2026-09-12 15:21:27.19	2026-10-12 00:00:00	144000.00	Công nợ từ đơn DH-2026-006	\N	admin-nguyenanhson	2026-09-12 15:21:27.206	\N	\N
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.payments (id, direction, payable_id, amount, payment_date, payment_method, transaction_code, note, status, created_by, created_at, cancelled_by, cancelled_at, proof_url) FROM stdin;
cmtygimqb000jd6avb0djrh0z	PAYABLE	cmtygi5xl000gd6avanargfvt	132000.00	2026-09-12 14:04:50.962	\N	\N	Thanh toán trọn đơn DH-2026-002	ACTIVE	admin-nguyenanhson	2026-09-12 14:04:50.963	\N	\N	\N
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.purchase_orders (id, order_code, supplier_id, facility_id, status, note, expected_date, created_by, reviewed_by, reviewed_at, reject_reason, result_receipt_id, result_payable_id, created_at, paid_at, paid_by, received_at, received_by, deleted_at, deleted_by) FROM stdin;
cmtyedla90001d601g4h4b1u5	DH-2026-001	cmt8ve6tr003pd6zctk223y7u	cmtva6i630001d6fhpljfo3oh	CANCELLED	\N	\N	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 13:56:42.197	\N	\N	\N	2026-09-12 13:04:56.577	\N	\N	\N	\N	\N	\N
cmtyg8kvw0003d6avnf4z1v1e	DH-2026-002	cmt8ve6tr003pd6zctk223y7u	cmtva6i630001d6fhpljfo3oh	PAID	\N	\N	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 13:57:15.856	\N	cmtygi5xb000cd6av9k2j0nkc	cmtygi5xl000gd6avanargfvt	2026-09-12 13:57:02.012	2026-09-12 14:04:50.962	admin-nguyenanhson	2026-09-12 14:04:29.176	admin-nguyenanhson	\N	\N
cmtygrsw90001d69zuzy0q9e4	DH-2026-003	cmt8ve6tg001sd6zcxmfo17sp	cmtva6i630001d6fhpljfo3oh	RECEIVED	\N	\N	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 14:13:17.138	\N	cmtygtl4q000ld69z2fm1nkme	cmtygtl4x000pd69zkkkvo2ws	2026-09-12 14:11:58.858	\N	\N	2026-09-12 14:13:22.102	admin-nguyenanhson	\N	\N
cmtygsdeu0006d69zgxnrixhi	DH-2026-004	cmt8ve6tg001sd6zcxmfo17sp	cmtva6i630001d6fhpljfo3oh	APPROVED	\N	\N	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 14:13:47.055	\N	\N	\N	2026-09-12 14:12:25.446	\N	\N	\N	\N	\N	\N
cmtygt4nh000bd69zv60xj3tx	DH-2026-005	cmt8ve6tg001sd6zcxmfo17sp	cmtva6i630001d6fhpljfo3oh	PENDING	\N	\N	admin-nguyenanhson	\N	\N	\N	\N	\N	2026-09-12 14:13:00.749	\N	\N	\N	\N	\N	\N
cmtyj8f3c0014d69zxasdqssj	DH-2026-006	cmt8ve6tr003pd6zctk223y7u	cmtva6i630001d6fhpljfo3oh	RECEIVED	\N	\N	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 15:21:13.493	\N	cmtyj957h001dd69z8yo2p79l	cmtyj957p001hd69zh5d91mub	2026-09-12 15:20:53.352	\N	\N	2026-09-12 15:21:27.19	admin-nguyenanhson	\N	\N
\.


--
-- Data for Name: purchase_receipts; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.purchase_receipts (id, receipt_code, supplier_id, facility_id, supplier_invoice_code, receipt_date, due_date, status, discount_amount, tax_amount, note, created_by, confirmed_by, created_at, deleted_at, deleted_by) FROM stdin;
cmtygi5xb000cd6av9k2j0nkc	PN-2026-001	cmt8ve6tr003pd6zctk223y7u	cmtva6i630001d6fhpljfo3oh	\N	2026-09-12 14:04:29.176	2026-10-12 00:00:00	CONFIRMED	0.00	0.00	Sinh từ đơn DH-2026-002	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 14:04:29.183	\N	\N
cmtygtl4q000ld69z2fm1nkme	PN-2026-002	cmt8ve6tg001sd6zcxmfo17sp	cmtva6i630001d6fhpljfo3oh	\N	2026-09-12 14:13:22.102	2026-10-12 00:00:00	CONFIRMED	0.00	0.00	Sinh từ đơn DH-2026-003	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 14:13:22.106	\N	\N
cmtyj957h001dd69z8yo2p79l	PN-2026-003	cmt8ve6tr003pd6zctk223y7u	cmtva6i630001d6fhpljfo3oh	\N	2026-09-12 15:21:27.19	2026-10-12 00:00:00	CONFIRMED	0.00	0.00	Sinh từ đơn DH-2026-006	admin-nguyenanhson	admin-nguyenanhson	2026-09-12 15:21:27.197	\N	\N
\.


--
-- Data for Name: receipt_items; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.receipt_items (id, receipt_id, item_name, unit, quantity, unit_price, note) FROM stdin;
cmtygi5xb000dd6avuv0ymhzp	cmtygi5xb000cd6av9k2j0nkc	Chả Bao Xả	túi	11.000	12000.00	\N
cmtygi5xb000ed6avik602xnm	cmtygi5xb000cd6av9k2j0nkc	Bột Ngọt Gà	túi	12.000	0.00	\N
cmtygtl4q000md69zgouhaowe	cmtygtl4q000ld69z2fm1nkme	Cốt Lẩu Nấm	Kg	1.000	1000.00	\N
cmtygtl4q000nd69zyrkb0xbc	cmtygtl4q000ld69z2fm1nkme	Mọc Chay	kg	2.000	2120.00	\N
cmtyj957h001ed69zba6vv7ql	cmtyj957h001dd69z8yo2p79l	Bột Ngọt Gà	túi	12.000	1000.00	\N
cmtyj957h001fd69zctw9l5kv	cmtyj957h001dd69z8yo2p79l	Chả Bao Xả	túi	11.000	12000.00	\N
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.settings (id, warning_days, critical_warning_days, currency, timezone) FROM stdin;
1	7	3	VND	Asia/Ho_Chi_Minh
\.


--
-- Data for Name: staff_permissions; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.staff_permissions (id, user_id, module, action, allowed) FROM stdin;
cmtzz6y1a0000d6uojihvonqi	cmtzyldib0000d6txboz9wv5h	dashboard	view	f
cmtzz6y1a0001d6uo8z3l5stu	cmtzyldib0000d6txboz9wv5h	suppliers	view	f
cmtzz6y1a0002d6uohtaiwt4x	cmtzyldib0000d6txboz9wv5h	suppliers	edit	f
cmtzz6y1a0003d6uoutc5hlwr	cmtzyldib0000d6txboz9wv5h	products	view	f
cmtzz6y1a0004d6uogtglj8gc	cmtzyldib0000d6txboz9wv5h	products	edit	f
cmtzz6y1b0005d6uo5t5m5rsk	cmtzyldib0000d6txboz9wv5h	orders	view	t
cmtzz6y1b0006d6uochjmiak3	cmtzyldib0000d6txboz9wv5h	orders	edit	t
cmtzz6y1b0007d6uoe46r8ch3	cmtzyldib0000d6txboz9wv5h	orders	approve	f
cmtzz6y1b0008d6uo9cmc5mk5	cmtzyldib0000d6txboz9wv5h	receipts	view	f
cmtzz6y1b0009d6uogfvq4351	cmtzyldib0000d6txboz9wv5h	receipts	edit	f
cmtzz6y1b000ad6uopz2qjl26	cmtzyldib0000d6txboz9wv5h	payables	view	f
cmtzz6y1b000bd6uojtehr0oy	cmtzyldib0000d6txboz9wv5h	payables	pay	f
cmtzz6y1b000cd6uonvcmmha8	cmtzyldib0000d6txboz9wv5h	payments	view	f
cmtzz6y1b000dd6uonsu8301d	cmtzyldib0000d6txboz9wv5h	inventory	view	f
cmtzz6y1b000ed6uoqo028i9h	cmtzyldib0000d6txboz9wv5h	inventory	edit	f
cmtzz6y1b000fd6uozo4iu9nl	cmtzyldib0000d6txboz9wv5h	reports	view	f
cmtzz6y1b000gd6uo262fd8mr	cmtzyldib0000d6txboz9wv5h	audit	view	f
cmtzz6y1b000hd6uozcq00ov6	cmtzyldib0000d6txboz9wv5h	users	view	f
cmtzz6y1b000id6uow4dksle3	cmtzyldib0000d6txboz9wv5h	users	edit	f
cmtzz6y1b000jd6uols34ncdt	cmtzyldib0000d6txboz9wv5h	settings	view	f
cmtzz6y1b000kd6uox10qkvp9	cmtzyldib0000d6txboz9wv5h	settings	edit	f
\.


--
-- Data for Name: supplier_product_price_history; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.supplier_product_price_history (id, supplier_product_id, old_price, new_price, source, changed_by, created_at) FROM stdin;
\.


--
-- Data for Name: supplier_products; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.supplier_products (id, supplier_id, name, unit, price, status, note) FROM stdin;
cmt8ve6tg0023d6zcilp5eelf	cmt8ve6tg001sd6zcxmfo17sp	Mọc Chay	kg	2120.00	ACTIVE	\N
cmt8ve6tg0020d6zcg0mg2j7t	cmt8ve6tg001sd6zcxmfo17sp	BB Bí Đỏ	khay	0.00	ACTIVE	\N
cmt8ve6tg001wd6zcus6sd5n1	cmt8ve6tg001sd6zcxmfo17sp	Cốt Lẩu Nấm	Kg	0.00	ACTIVE	\N
cmt8ve6tg0025d6zcrwwd1gry	cmt8ve6tg001sd6zcxmfo17sp	Bate mít	hộp	1234.00	ACTIVE	\N
cmt8ve6tg001td6zc861f1pij	cmt8ve6tg001sd6zcxmfo17sp	Sốt Dầu Hào	kg	0.00	ACTIVE	\N
cmt8ve6tg001ud6zcpv37px7k	cmt8ve6tg001sd6zcxmfo17sp	Sốt Kho	kg	0.00	ACTIVE	\N
cmt8ve6tg001vd6zc438oqo2u	cmt8ve6tg001sd6zcxmfo17sp	Sốt Nấm	kg	0.00	ACTIVE	\N
cmt8ve6tg001xd6zc36vcwe0u	cmt8ve6tg001sd6zcxmfo17sp	Cốt Phở vị mộc	Kg	0.00	ACTIVE	\N
cmt8ve6tg001yd6zc1kz8lys4	cmt8ve6tg001sd6zcxmfo17sp	Sốt Mè	kg	0.00	ACTIVE	\N
cmt8ve6tg001zd6zc2uv42uws	cmt8ve6tg001sd6zcxmfo17sp	Sa Tế Chay	kg	0.00	ACTIVE	\N
cmt8ve6tg0021d6zczd62d9rd	cmt8ve6tg001sd6zcxmfo17sp	BB Rau Củ	Khay	0.00	ACTIVE	\N
cmt8ve6tg0022d6zcyvzi4rxe	cmt8ve6tg001sd6zcxmfo17sp	Đạm Bò Chay	kg	0.00	ACTIVE	\N
cmt8ve6tg0024d6zc4mtp5ikx	cmt8ve6tg001sd6zcxmfo17sp	Mì rau củ	túi	0.00	ACTIVE	\N
cmt8ve6tg0026d6zcuw485mvu	cmt8ve6tg001sd6zcxmfo17sp	Chả Mít	kg	0.00	ACTIVE	\N
cmt8ve6tg0027d6zcislbftl0	cmt8ve6tg001sd6zcxmfo17sp	Mì căn	kg	0.00	ACTIVE	\N
cmt8ve6tl0029d6zctfvmuh89	cmt8ve6tl0028d6zcys2mzq6y	Hạt Sen	kg	0.00	ACTIVE	\N
cmt8ve6tl002ad6zc5wsv7dgg	cmt8ve6tl0028d6zcys2mzq6y	Đỗ Xanh	kg	0.00	ACTIVE	\N
cmt8ve6tl002bd6zcngwm7r94	cmt8ve6tl0028d6zcys2mzq6y	Bột Thính	túi	0.00	ACTIVE	\N
cmt8ve6tl002cd6zcbawhlufm	cmt8ve6tl0028d6zcys2mzq6y	Mầu Điều	hộp	0.00	ACTIVE	\N
cmt8ve6tl002dd6zcv1j1zo18	cmt8ve6tl0028d6zcys2mzq6y	Bột Canh I Ốt	túi	0.00	ACTIVE	\N
cmt8ve6tl002ed6zcw2lyru4a	cmt8ve6tl0028d6zcys2mzq6y	Muối	túi	0.00	ACTIVE	\N
cmt8ve6tl002fd6zc6piw7nbm	cmt8ve6tl0028d6zcys2mzq6y	Đường	kg	0.00	ACTIVE	\N
cmt8ve6tl002gd6zcm4ah2679	cmt8ve6tl0028d6zcys2mzq6y	Lạc	kg	0.00	ACTIVE	\N
cmt8ve6tl002hd6zcmp208l5r	cmt8ve6tl0028d6zcys2mzq6y	Vừng	Kg	0.00	ACTIVE	\N
cmt8ve6tl002id6zctj074qq2	cmt8ve6tl0028d6zcys2mzq6y	Ớt Bột	túi	0.00	ACTIVE	\N
cmt8ve6tl002jd6zcofrriue5	cmt8ve6tl0028d6zcys2mzq6y	Tiêu Đen	kg	0.00	ACTIVE	\N
cmt8ve6tl002kd6zca11rpohc	cmt8ve6tl0028d6zcys2mzq6y	Túi Rác Đen	kg	0.00	ACTIVE	\N
cmt8ve6tl002ld6zcayoeojdt	cmt8ve6tl0028d6zcys2mzq6y	Túi Nylon	kg	0.00	ACTIVE	\N
cmt8ve6tl002md6zcubiqbvnp	cmt8ve6tl0028d6zcys2mzq6y	Găng Tay Nylon	kg	0.00	ACTIVE	\N
cmt8ve6tl002nd6zc7modthhn	cmt8ve6tl0028d6zcys2mzq6y	Nước Cốt Dừa	hộp	0.00	ACTIVE	\N
cmt8ve6tl002od6zcig0mc2jj	cmt8ve6tl0028d6zcys2mzq6y	Sữa Đặc	hộp	0.00	ACTIVE	\N
cmt8ve6tl002pd6zcvs0pxehg	cmt8ve6tl0028d6zcys2mzq6y	Chai Nhựa 300ml	chai	0.00	ACTIVE	\N
cmt8ve6tl002qd6zcfhunc6x5	cmt8ve6tl0028d6zcys2mzq6y	Cốc Nhựa 700ml	dây	0.00	ACTIVE	\N
cmt8ve6tl002rd6zc60p1s20z	cmt8ve6tl0028d6zcys2mzq6y	Trà Sâm Dứa	túi	0.00	ACTIVE	\N
cmt8ve6tl002sd6zckxeenei5	cmt8ve6tl0028d6zcys2mzq6y	Miến Khô	túi	0.00	ACTIVE	\N
cmt8ve6tl002td6zcqtzaskik	cmt8ve6tl0028d6zcys2mzq6y	Sốt Cà Chua	can	0.00	ACTIVE	\N
cmt8ve6tm002ud6zctrop1etb	cmt8ve6tl0028d6zcys2mzq6y	Tương Ớt	can	0.00	ACTIVE	\N
cmt8ve6tm002vd6zc006ryftw	cmt8ve6tl0028d6zcys2mzq6y	Tương quê tôi	can	0.00	ACTIVE	\N
cmt8ve6tm002wd6zcdhlb9mw3	cmt8ve6tl0028d6zcys2mzq6y	Bột Béo	túi	0.00	ACTIVE	\N
cmt8ve6tm002xd6zcu4qp37hu	cmt8ve6tl0028d6zcys2mzq6y	Mộc Nhĩ	kg	0.00	ACTIVE	\N
cmt8ve6tm002yd6zc56mx3ofg	cmt8ve6tl0028d6zcys2mzq6y	Bột Năng	túi	0.00	ACTIVE	\N
cmt8ve6tm002zd6zciprst4zf	cmt8ve6tl0028d6zcys2mzq6y	Bột Chiên Xù	túi	0.00	ACTIVE	\N
cmt8ve6tm0030d6zcbuixwk3w	cmt8ve6tl0028d6zcys2mzq6y	Đẳng Sâm	kg	0.00	ACTIVE	\N
cmt8ve6tm0031d6zchqznx1r2	cmt8ve6tl0028d6zcys2mzq6y	Kỳ Tử	kg	0.00	ACTIVE	\N
cmt8ve6tm0032d6zctw9smbnw	cmt8ve6tl0028d6zcys2mzq6y	Quế	kg	0.00	ACTIVE	\N
cmt8ve6tm0033d6zceya2uq7p	cmt8ve6tl0028d6zcys2mzq6y	Hoa Hồi	kg	0.00	ACTIVE	\N
cmt8ve6tm0034d6zch7alkzbg	cmt8ve6tl0028d6zcys2mzq6y	Thảo Quả	kg	0.00	ACTIVE	\N
cmt8ve6tm0035d6zctr18z72o	cmt8ve6tl0028d6zcys2mzq6y	Me Thái	hộp	0.00	ACTIVE	\N
cmt8ve6tm0036d6zcv2pv4jyy	cmt8ve6tl0028d6zcys2mzq6y	Chà Là	hộp	0.00	ACTIVE	\N
cmt8ve6tm0037d6zco61wrjjs	cmt8ve6tl0028d6zcys2mzq6y	Bột Sư Tử	hộp	0.00	ACTIVE	\N
cmt8ve6tm0038d6zcehrizypk	cmt8ve6tl0028d6zcys2mzq6y	Bột Chiên Giòn	túi	0.00	ACTIVE	\N
cmt8ve6tm0039d6zcsxxkxw01	cmt8ve6tl0028d6zcys2mzq6y	Dấm Trắng	can	0.00	ACTIVE	\N
cmt8ve6tm003ad6zcud02i27t	cmt8ve6tl0028d6zcys2mzq6y	Táo Đỏ	kg	0.00	ACTIVE	\N
cmt8ve6tm003bd6zcizbajbz9	cmt8ve6tl0028d6zcys2mzq6y	Hoài Sơn	kg	0.00	ACTIVE	\N
cmt8ve6tm003cd6zc39vur5wd	cmt8ve6tl0028d6zcys2mzq6y	Giấy Ăn	bịch	0.00	ACTIVE	\N
cmt8ve6tm003dd6zcw2d4l8vx	cmt8ve6tl0028d6zcys2mzq6y	Đũa thìa	túi	0.00	ACTIVE	\N
cmt8ve6tm003ed6zciuuo6p6a	cmt8ve6tl0028d6zcys2mzq6y	Xì Dầu Đặc Biệt	chai	0.00	ACTIVE	\N
cmt8ve6tm003fd6zcvcfb45tm	cmt8ve6tl0028d6zcys2mzq6y	Hạt Điều	kg	0.00	ACTIVE	\N
cmt8ve6tm003gd6zclezm6z9h	cmt8ve6tl0028d6zcys2mzq6y	Gạo Đen	bao	0.00	ACTIVE	\N
cmt8ve6tm003hd6zcdbaijyfz	cmt8ve6tl0028d6zcys2mzq6y	Dầu Ăn	can	0.00	ACTIVE	\N
cmt8ve6tm003id6zc7oo957ch	cmt8ve6tl0028d6zcys2mzq6y	Gạo Hồng	bao	0.00	ACTIVE	\N
cmt8ve6tm003jd6zciye3378q	cmt8ve6tl0028d6zcys2mzq6y	Gạo Trắng	bao	0.00	ACTIVE	\N
cmt8ve6tm003kd6zc12bofaqp	cmt8ve6tl0028d6zcys2mzq6y	Nước Mắm	chai	0.00	ACTIVE	\N
cmt8ve6tm003ld6zcprb2tm5b	cmt8ve6tl0028d6zcys2mzq6y	túi đỏ to	kg	0.00	ACTIVE	\N
cmt8ve6tm003md6zctk109he7	cmt8ve6tl0028d6zcys2mzq6y	Nấm Hương	kg	0.00	ACTIVE	\N
cmt8ve6tm003nd6zcnheb37em	cmt8ve6tl0028d6zcys2mzq6y	Dầu Hào	chai	0.00	ACTIVE	\N
cmt8ve6tm003od6zcrowbigbi	cmt8ve6tl0028d6zcys2mzq6y	Váng Đậu Chiên	túi	0.00	ACTIVE	\N
cmt8ve6tr003qd6zc4aciyp8u	cmt8ve6tr003pd6zctk223y7u	Nấm Đông Cô	túi	0.00	ACTIVE	\N
cmt8ve6tr003rd6zcz3lr9n5y	cmt8ve6tr003pd6zctk223y7u	túi đỏ nhỏ	kg	0.00	ACTIVE	\N
cmt8ve6tr003sd6zcavk40d63	cmt8ve6tr003pd6zctk223y7u	Rong Biển Khô nấu	túi	0.00	ACTIVE	\N
cmt8ve6tr003td6zcv4ed2euq	cmt8ve6tr003pd6zctk223y7u	Rong Biển Cuộn	túi	0.00	ACTIVE	\N
cmt8ve6tr003ud6zc6g6v8ewe	cmt8ve6tr003pd6zctk223y7u	Hạt Nêm	túi	0.00	ACTIVE	\N
cmt8ve6tr003vd6zclpoqmluv	cmt8ve6tr003pd6zctk223y7u	Hạnh Nhân	kg	0.00	ACTIVE	\N
cmt8ve6tr003wd6zc824w4ha6	cmt8ve6tr003pd6zctk223y7u	Nho Khô	kg	0.00	ACTIVE	\N
cmt8ve6tr003yd6zcxbfyevdb	cmt8ve6tr003pd6zctk223y7u	Giò Chay	cái	0.00	ACTIVE	\N
cmt8ve6tr003zd6zcma9j52ul	cmt8ve6tr003pd6zctk223y7u	Chả Quế Chay	túi	0.00	ACTIVE	\N
cmt8ve6tu0042d6zc4az24bog	cmt8ve6tu0041d6zccat8av0q	Phở Khô	kg	0.00	ACTIVE	\N
cmt8ve6tu0043d6zcwgrb2hd9	cmt8ve6tu0041d6zccat8av0q	Bánh Đa Nem	kg	0.00	ACTIVE	\N
cmt8ve6tu0044d6zc5nmisup1	cmt8ve6tu0041d6zccat8av0q	Bún Khô	kg	0.00	ACTIVE	\N
cmt8ve6tx0046d6zc0u2cy66r	cmt8ve6tx0045d6zcejd4qo5x	Bánh Đa Vừng	kg	0.00	ACTIVE	\N
cmt8ve6tz0048d6zciqxwnxhq	cmt8ve6tz0047d6zcxwtimnoc	Vỏ Há Cảo	cái	0.00	ACTIVE	\N
cmt8ve6u1004ad6zcgls0sump	cmt8ve6u10049d6zcifiswca1	Váng Đậu Tươi	túi	0.00	ACTIVE	\N
cmt8ve6u4004cd6zckk0mjuv3	cmt8ve6u4004bd6zcyik5lnt7	Nước Lavie	chai	0.00	ACTIVE	\N
cmt8ve6u4004dd6zca1dsvaqr	cmt8ve6u4004bd6zcyik5lnt7	Bia Ken	lon	0.00	ACTIVE	\N
cmt8ve6u4004ed6zc4gi3w4m3	cmt8ve6u4004bd6zcyik5lnt7	Bia 0 Độ	lon	0.00	ACTIVE	\N
cmt8ve6u4004fd6zcm60pitml	cmt8ve6u4004bd6zcyik5lnt7	Nước Ngọt	lon	0.00	ACTIVE	\N
cmt8ve6u6004hd6zc9jz0g76d	cmt8ve6u6004gd6zc4jir7s4x	Bát Giấy To	hộp	0.00	ACTIVE	\N
cmt8ve6u6004id6zctu7rq8mc	cmt8ve6u6004gd6zc4jir7s4x	Bát Giấy Nhỡ	hộp	0.00	ACTIVE	\N
cmt8ve6u6004jd6zc4u6epjx4	cmt8ve6u6004gd6zc4jir7s4x	Tảo Xoắn	kg	0.00	ACTIVE	\N
cmt8ve6tr0040d6zc1hoqh3ca	cmt8ve6tr003pd6zctk223y7u	Chả Bao Xả	túi	12000.00	ACTIVE	\N
cmt8ve6tr003xd6zcq9x1pdi8	cmt8ve6tr003pd6zctk223y7u	Bột Ngọt Gà	túi	1000.00	ACTIVE	\N
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.suppliers (id, code, name, phone, email, tax_code, contact_person, address, note, status, bank_account_name, bank_account_no, bank_name, qr_code_url) FROM stdin;
cmt8ve6tg001sd6zcxmfo17sp	NCC004	Homefood	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6tl0028d6zcys2mzq6y	NCC005	Hương đồ khô	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6tr003pd6zctk223y7u	NCC006	Chợ Đồng Xuân	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6tu0041d6zccat8av0q	NCC007	Phở khô	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6tx0045d6zcejd4qo5x	NCC008	Bánh Đa Vừng Mặt Hừng	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6tz0047d6zcxwtimnoc	NCC009	Vỏ Há Cảo	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6u10049d6zcifiswca1	NCC010	Váng Đậu Tươi	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6u4004bd6zcyik5lnt7	NCC011	Nước Lavie	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
cmt8ve6u6004gd6zc4jir7s4x	NCC012	Bát Giấy To	\N	\N	\N	\N	\N	\N	ACTIVE	\N	\N	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: debtflow
--

COPY public.users (id, name, email, password_hash, role, status, last_login_at, created_at) FROM stdin;
admin-nguyenanhson	Nguyễn Ánh Sơn	nguyenanhson@gardenchay.com	$2a$10$t.ci6CQApZNEVyKKh0Tkjeblztl3kUTNfhmdV7HRtLdNKyamL6J.e	ADMIN	ACTIVE	2026-09-10 08:40:48.961	2026-09-10 08:39:54.484
cmtzyldib0000d6txboz9wv5h	test 	test1@gmail.comte	$2a$10$b/h1ydq662IpiV2tlTF.6OKRcmb6wxyEFv1CemL7oQKdayhHOCywm	STAFF	ACTIVE	2026-09-13 15:49:05.026	2026-09-13 15:18:38.244
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);


--
-- Name: inventory_issues inventory_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT inventory_issues_pkey PRIMARY KEY (id);


--
-- Name: issue_items issue_items_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.issue_items
    ADD CONSTRAINT issue_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: payables payables_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id);


--
-- Name: receipt_items receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: staff_permissions staff_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_pkey PRIMARY KEY (id);


--
-- Name: supplier_product_price_history supplier_product_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.supplier_product_price_history
    ADD CONSTRAINT supplier_product_price_history_pkey PRIMARY KEY (id);


--
-- Name: supplier_products supplier_products_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.supplier_products
    ADD CONSTRAINT supplier_products_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: facilities_code_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX facilities_code_key ON public.facilities USING btree (code);


--
-- Name: inventory_issues_issue_code_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX inventory_issues_issue_code_key ON public.inventory_issues USING btree (issue_code);


--
-- Name: payables_invoice_code_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX payables_invoice_code_key ON public.payables USING btree (invoice_code);


--
-- Name: payables_purchase_receipt_id_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX payables_purchase_receipt_id_key ON public.payables USING btree (purchase_receipt_id);


--
-- Name: purchase_orders_order_code_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX purchase_orders_order_code_key ON public.purchase_orders USING btree (order_code);


--
-- Name: purchase_receipts_receipt_code_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX purchase_receipts_receipt_code_key ON public.purchase_receipts USING btree (receipt_code);


--
-- Name: staff_permissions_user_id_module_action_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX staff_permissions_user_id_module_action_key ON public.staff_permissions USING btree (user_id, module, action);


--
-- Name: supplier_product_price_history_supplier_product_id_idx; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE INDEX supplier_product_price_history_supplier_product_id_idx ON public.supplier_product_price_history USING btree (supplier_product_id);


--
-- Name: suppliers_code_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX suppliers_code_key ON public.suppliers USING btree (code);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: debtflow
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: inventory_issues inventory_issues_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT inventory_issues_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: issue_items issue_items_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.issue_items
    ADD CONSTRAINT issue_items_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.inventory_issues(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.purchase_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payables payables_purchase_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_purchase_receipt_id_fkey FOREIGN KEY (purchase_receipt_id) REFERENCES public.purchase_receipts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payables payables_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_payable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payable_id_fkey FOREIGN KEY (payable_id) REFERENCES public.payables(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_receipts purchase_receipts_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_receipts purchase_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: receipt_items receipt_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.purchase_receipts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: staff_permissions staff_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: supplier_product_price_history supplier_product_price_history_supplier_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.supplier_product_price_history
    ADD CONSTRAINT supplier_product_price_history_supplier_product_id_fkey FOREIGN KEY (supplier_product_id) REFERENCES public.supplier_products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: supplier_products supplier_products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: debtflow
--

ALTER TABLE ONLY public.supplier_products
    ADD CONSTRAINT supplier_products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict mF8BlflADpIaf5coKCCBv9abToPJO7sTHMkpizQQQyXGJEFwQcN5jv2ie6JPqDS

