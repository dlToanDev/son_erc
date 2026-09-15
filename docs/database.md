# Database — DebtFlow

PostgreSQL 16, accessed exclusively through Prisma 6.
Schema: `apps/api/prisma/schema.prisma`. Migrations: `apps/api/prisma/migrations/`.

## Conventions

- Models are PascalCase in Prisma, tables/columns are snake_case via `@map`/`@@map`.
- Primary keys are `cuid()` strings.
- **Money: `Decimal(18, 2)`. Quantity: `Decimal(14, 3)`** (supports e.g. 12.5 kg).
  Prisma returns `Decimal`; services convert with `Number()` only when serializing.
- Timestamps are `DateTime` (Postgres `timestamp(3)`), stored UTC. Display timezone
  is a setting (`Asia/Ho_Chi_Minh`), not a column type.

## Enums

| Enum | Values |
|---|---|
| `UserRole` | `ADMIN`, `STAFF` |
| `EntityStatus` | `ACTIVE`, `INACTIVE` |
| `OrderStatus` | `PENDING`, `APPROVED`, `RECEIVED`, `PAID`, `REJECTED`, `CANCELLED` |
| `ReceiptStatus` | `DRAFT`, `CONFIRMED` |
| `RecordStatus` | `ACTIVE`, `CANCELLED` (soft-void) |
| `PaymentDirection` | `PAYABLE`, `RECEIVABLE` |

> `packages/shared/src/enums.ts` is **out of date**: its `OrderStatus` lacks
> `RECEIVED`/`PAID` and its `PaymentDirection` uses `OUT`/`IN`. Trust Prisma.
> `PaymentDirection.RECEIVABLE` is currently unused — `orders.service.ts` always
> writes `PAYABLE`.

## Tables

### Identity & access

**`users`** — `id`, `name`, `email` (unique), `password_hash`, `role`, `status`,
`last_login_at`, `created_at`. Never select `password_hash`.

**`staff_permissions`** — `user_id → users` (cascade delete), `module`, `action`,
`allowed`. Unique on `(user_id, module, action)`. Only consulted for `STAFF`;
`ADMIN` short-circuits in `PermissionGuard`. Canonical module×action list lives in
`PERMISSION_MODULES` (`packages/shared/src/master-data.ts`).

### Master data

**`facilities`** — `code` (unique), `name`, `address`, `status`. The multi-site axis.

**`suppliers`** — `code` (unique), `name`, contact fields, tax code, bank details
(`bank_name`, `bank_account_no`, `bank_account_name`, `qr_code_url`), `status`.

**`supplier_products`** — `supplier_id`, `name`, `unit`, `price Decimal(18,2)`,
`status`. This is the **price catalogue**; order prices are snapshotted from here.

**`supplier_product_price_history`** — `old_price`, `new_price`, `source`
(`'CATALOG' | 'ORDER_EDIT'`), `changed_by`, `created_at`. Indexed on
`supplier_product_id`. Written whenever a catalogue price changes or a price is
edited while approving/receiving an order.

### Purchasing

**`purchase_orders`** — `order_code` (unique, `DH-YYYY-NNN`), `supplier_id`,
`facility_id`, `status`, `note`, `expected_date`, lifecycle actor/time columns
(`created_by`, `reviewed_by/at`, `received_by/at`, `paid_by/at`), `reject_reason`,
`result_receipt_id`, `result_payable_id`, `created_at`, **`deleted_at` / `deleted_by`**.

`result_receipt_id` / `result_payable_id` are plain strings, not relations — the
services resolve the codes with extra queries.

**`order_items`** — `order_id` (cascade), optional `product_id`, plus a **snapshot**
of `name`, `unit`, `unit_price`, `quantity`. Snapshotting is deliberate: later
catalogue edits must not rewrite history.

**`purchase_receipts`** — `receipt_code` (unique, `PN-YYYY-NNN`), supplier, facility,
`supplier_invoice_code`, `receipt_date`, `due_date`, `status`, `discount_amount`,
`tax_amount`, `created_by`, `confirmed_by`, **soft delete**.
**`receipt_items`** — `item_name`, `unit`, `quantity`, `unit_price`, `note`.

### Payables

**`payables`** — `invoice_code` (unique), `supplier_id`, `purchase_receipt_id`
(unique, nullable → 1:1 with a receipt), `invoice_date`, `due_date`,
`total_amount`, `description`, `note`, `created_by`, **soft delete**.

> **There is no `status` or `balance` column, by design.** Both are computed on read
> by `src/domain/invoice.calculator.ts` from the `ACTIVE` payments and `due_date`:
> `UNPAID → PARTIAL → PAID`, or `OVERDUE` when a balance remains past `due_date`.
> A payable with no `due_date` is never `OVERDUE`.

**`payments`** — `direction`, `payable_id`, `amount`, `payment_date`,
`payment_method`, `transaction_code`, `proof_url`, `note`, `status`
(`ACTIVE`/`CANCELLED`), `created_by`, `cancelled_by/at`.
Payments are **voided, never deleted** — cancelled rows are excluded from balances.

### Inventory

**`inventory_issues`** — `issue_code` (unique, `PX-YYYY-NNN`), `facility_id`,
`issue_date`, `status` (soft-void), actor columns.
**`issue_items`** — `item_name`, `unit`, `quantity`.

Stock is a **ledger, not a balance table**: closing stock is derived from confirmed
receipts minus active issues by `src/domain/inventory.ledger.ts`. Item identity
across receipts and issues is the free-text `item_name` + `unit` pair.

### System

**`audit_logs`** — append-only: `time`, `user_id` (string, **no FK**), `action`,
`entity_type`, `entity_id`, `detail`. The only paginated list in the app.

**`settings`** — singleton with `id = 1`, upserted on first read:
`warning_days` (7), `critical_warning_days` (3), `currency` (`VND`),
`timezone` (`Asia/Ho_Chi_Minh`).

## Delete semantics

| Entity | Mechanism |
|---|---|
| `purchase_orders`, `purchase_receipts`, `payables` | soft delete — `deleted_at`, filter `deletedAt: null` on **every** query |
| `payments`, `inventory_issues` | soft-void — `status = CANCELLED` |
| `order_items`, `receipt_items`, `issue_items`, `staff_permissions`, price history | hard delete via `onDelete: Cascade` from the parent |
| `users`, `suppliers`, `facilities`, `supplier_products` | not deleted — `status = INACTIVE` |

## Migrations

| Migration | Contents |
|---|---|
| `20260821133647_init` | full initial schema |
| `20260824000000_add_supplier_bank_and_payment_proof` | supplier bank fields + `payments.proof_url` |
| `20260912000000_order_lifecycle_status` | adds `RECEIVED`/`PAID` to `OrderStatus` + received/paid columns (written idempotently with `IF NOT EXISTS` to repair DBs advanced by `db push`) |
| `20260913000000_order_soft_delete` | `deleted_at`/`deleted_by` on orders, receipts, payables |
| `20260913010000_supplier_price_history` | `supplier_product_price_history` |

Two of these are catch-up migrations written after the schema had drifted —
a reminder that **`prisma db push` must not be used in this repo**.

```bash
# create + apply during development
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name <snake_case>
# apply in production (also run automatically by apps/api/docker-entrypoint.sh)
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

Adding a value to an existing enum needs `ALTER TYPE ... ADD VALUE`, which cannot
run inside a transaction with other statements on the same type — keep it in its
own migration, as `20260912000000` does.

## Indexes — current state

Declared: the `@unique` constraints listed above, plus `@@index([supplierProductId])`
on price history. **That is all.** Every filtered list query (`facility_id`,
`status`, `deleted_at`, `supplier_id`, `payable_id`, `receipt_date`, `audit_logs.time`)
is unindexed. See `docs/architecture.md` §8.14.

## Seeding

`apps/api/prisma/seed.ts`, run with `npm run prisma:seed --workspace apps/api`.

**It calls `reset()` first, which `deleteMany()`s every table.** Never point it at
data you care about. It creates 1 admin + 3 staff + 3 facilities and sample
purchasing data for 01/05/2026 – 25/08/2026. Credentials come from
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, defaulting to
`admin@debtflow.local` / `admin123`; staff accounts use `staff123`.

New `STAFF` users (seed and `UsersService.create`) get exactly two permissions:
`orders.view` and `orders.edit`. Everything else is granted by an admin.

## Backups

The production compose runs a sidecar that writes `debtflow-YYYYMMDD-HHMMSS.sql.gz`
(`pg_dump --clean --if-exists`) into the `backups` volume daily and mirrors it
offsite via rclone. The API mounts that volume **read-only** at `/backups` and can
restore the newest file through `POST /settings/restore-latest` — a full,
irreversible overwrite of the database.
