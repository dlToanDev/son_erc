# API — DebtFlow

Hand-maintained reference (there is no Swagger/OpenAPI in this project — if you add
or change a route, edit this file). Source of truth: `apps/api/src/**/*.controller.ts`.

## Conventions

- **Base path `/api/v1`** (`app.setGlobalPrefix`). nginx proxies `/api` in production;
  Vite proxies `/api` in development.
- All request bodies are JSON and validated by a global `ValidationPipe` with
  `whitelist: true, forbidNonWhitelisted: true, transform: true` — **an unknown
  field returns 400**, it is not ignored.
- Authentication: `Authorization: Bearer <accessToken>` on everything except
  `/health` and the `/auth` login/refresh/logout routes.
- Authorization: class-level `@UseGuards(JwtAuthGuard, PermissionGuard)` plus
  method-level `@RequirePermission(module, action)`. `ADMIN` bypasses all checks.
  **A route with no `@RequirePermission` only needs a valid login.**
- Errors are standard Nest shapes: `{ statusCode, message, error }`, where `message`
  is a string or a string[] of validation errors. Messages are in Vietnamese.
  `401` unauthenticated · `403` missing permission · `404` not found ·
  `409` conflict (duplicate code/email) · `400` validation or invalid state
  transition · `429` throttled.
- Money is returned as a **JS number**, dates as ISO 8601 strings.
- Response types live in `packages/shared/src/`.

## Rate limits

Global `ThrottlerModule`: 100 requests / 60 s. `POST /auth/login`: 5 / 60 s.

---

## Auth — `/auth`

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/auth/login` | public, 5/min | `{ email, password }` → `{ accessToken, user }`, sets httpOnly `refresh_token` cookie (`path=/api/v1/auth`) |
| POST | `/auth/refresh` | refresh cookie | rotates both tokens → `{ accessToken, user }` |
| POST | `/auth/logout` | public | clears the cookie → `{ ok: true }` |
| GET | `/auth/me` | logged in | current user + permissions |

The access token is never persisted by the browser — on reload the SPA calls
`/auth/refresh` once (`RequireAuth`) to restore the session.

## Health — `/health`

| GET | `/health` | public | `{ status, service, timestamp }` — static, does **not** check the DB |

## Facilities — `/facilities`

| Method | Path | Permission |
|---|---|---|
| GET | `/facilities` | *logged in only* |
| POST | `/facilities` | `settings.edit` |
| PATCH | `/facilities/:id` | `settings.edit` |

## Suppliers & products — `/suppliers`

| Method | Path | Permission |
|---|---|---|
| GET | `/suppliers?search=` | *logged in only* |
| GET | `/suppliers/:id` | `suppliers.view` |
| POST | `/suppliers` | `suppliers.edit` |
| PATCH | `/suppliers/:id` | `suppliers.edit` |
| GET | `/suppliers/:id/products` | *logged in only* |
| POST | `/suppliers/:id/products` | `products.edit` |
| PATCH | `/suppliers/:id/products/:productId` | `products.edit` |
| DELETE | `/suppliers/:id/products/:productId` | `products.edit` |
| GET | `/suppliers/:id/products/:productId/price-history` | `products.view` |

Changing a product price writes a `supplier_product_price_history` row with
`source = 'CATALOG'`.

## Orders — `/orders`

| Method | Path | Permission | Effect |
|---|---|---|---|
| GET | `/orders?facilityId=&status=` | `orders.view` | `facilityId` accepts a comma-separated list. **No pagination.** |
| GET | `/orders/pending-count` | `orders.view` | `{ count }` for the sidebar badge |
| GET | `/orders/:id` | `orders.view` | |
| POST | `/orders` | `orders.edit` | prices snapshotted server-side from the supplier catalogue; client prices are ignored |
| PUT | `/orders/:id` | `orders.edit` | editable only while `PENDING` |
| POST | `/orders/:id/approve` | `orders.approve` | `PENDING → APPROVED`. No documents created. |
| POST | `/orders/:id/receive` | `orders.approve` | `APPROVED → RECEIVED`; **creates a confirmed `PurchaseReceipt` and a `Payable`** (due = +30 days) |
| POST | `/orders/:id/pay` | `orders.approve` | `RECEIVED → PAID`; creates a `Payment` against the payable |
| POST | `/orders/:id/reject` | `orders.approve` | `{ reason }` → `REJECTED` |
| POST | `/orders/:id/cancel` | `orders.edit` | `PENDING → CANCELLED` |
| DELETE | `/orders/:id` | `orders.edit` | **soft** delete (`deleted_at`) |

Every transition runs inside a transaction holding `SELECT ... FOR UPDATE` on the
order row, re-reads the status, and writes an audit entry.

> **Known gap:** the response always includes `unitPrice` and `total`. The
> `orders.viewPrice` permission that is supposed to hide money from staff is only
> applied by the React components.

## Receipts — `/receipts`

| Method | Path | Permission |
|---|---|---|
| GET | `/receipts?supplierId=&facilityId=&status=` | `receipts.view` |
| GET | `/receipts/:id` | `receipts.view` |
| POST | `/receipts` | `receipts.edit` |
| POST | `/receipts/:id/confirm` | `receipts.edit` |

Confirming a `DRAFT` receipt is what creates its `Payable`.

## Payables — `/payables`

| Method | Path | Permission |
|---|---|---|
| GET | `/payables?supplierId=&status=` | `payables.view` |
| GET | `/payables/:id` | `payables.view` |

`status` is `UNPAID | PARTIAL | PAID | OVERDUE`, **computed at read time** from the
active payments and `dueDate` — so the `status` query parameter is applied in
application code *after* loading every payable, not in SQL. `balance` and `paid`
are likewise derived. Detail responses embed the payment history.

## Payments — `/payments`

| Method | Path | Permission |
|---|---|---|
| GET | `/payments?payableId=&supplierId=` | `payments.view` |
| POST | `/payments` | `payables.pay` |
| POST | `/payments/:id/void` | `payables.pay` |

Payments are never deleted — voiding sets `status = CANCELLED` and the row stops
counting toward the balance. Overpaying a payable is rejected.

## Inventory — `/inventory`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/inventory/issues?facilityId=&status=` | `inventory.view` | |
| POST | `/inventory/issues` | `inventory.edit` | issue code `PX-YYYY-NNN` |
| PUT | `/inventory/issues/:id` | `inventory.edit` | |
| POST | `/inventory/issues/:id/cancel` | `inventory.edit` | soft-void |
| POST | `/inventory/check` | `inventory.view` | dry-run stock availability for a draft issue |
| GET | `/inventory/report?from=&to=&facilityId=` | `inventory.view` | opening / in / out / closing per item |
| GET | `/inventory/card?facilityId=&itemName=&unit=&from=&to=` | `inventory.view` | stock card (ledger) for one item |

Stock is derived from confirmed receipts minus active issues; items are matched on
`(itemName, unit)`. Issue writes lock the facility row (`FOR UPDATE`) to keep
concurrent issues from overdrawing stock.

## Reports — `/reports`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/reports/dashboard?range=&facilityId=` | `dashboard.view` | `range` ∈ `1m,3m,6m,12m`; KPIs, series, facility comparison |
| GET | `/reports/debt-alerts` | `dashboard.view` | uses `warningDays` / `criticalWarningDays` from settings |
| GET | `/reports/stats?range=&facilityId=&from=&to=` | `reports.view` | |
| GET | `/reports/payables-aging` | `reports.view` | aging buckets + totals |
| GET | `/reports/compare?fromA=&toA=&fromB=&toB=&facilityId=` | `reports.view` | two-period comparison |

Dates are `YYYY-MM-DD` and interpreted as `[from 00:00 UTC, to+1 00:00 UTC)`.
All report aggregation happens in Node over full table loads, not in SQL.

## Users & permissions — `/users`

| Method | Path | Permission |
|---|---|---|
| GET | `/users` | `users.view` |
| POST | `/users` | `users.edit` |
| PATCH | `/users/:id` | `users.edit` |
| PUT | `/users/:id/permissions` | `users.edit` |

`password_hash` is never returned. An admin cannot deactivate or demote their own
account. `PUT .../permissions` replaces the whole permission set in one transaction.
New `STAFF` users are created with `orders.view` + `orders.edit` only.

## Audit log — `/audit-logs`

| GET | `/audit-logs?page=1&pageSize=20&action=&entityType=&userId=&from=&to=` | `audit.view` |

Returns `{ data, total, page, pageSize }` — the only server-paginated endpoint.
`userId` has no FK, so user names are resolved with a follow-up query.

## Settings & restore — `/settings`

| Method | Path | Permission |
|---|---|---|
| GET | `/settings` | *logged in only* |
| PUT | `/settings` | `settings.edit` |
| GET | `/settings/latest-backup` | *logged in only* |
| POST | `/settings/restore-latest` | `settings.edit` |

`GET /settings` upserts the singleton row (`id = 1`) if it is missing.

> **`POST /settings/restore-latest` overwrites the entire database** from the newest
> `debtflow-*.sql.gz` in `BACKUP_DIR`, by piping `gunzip` into `psql`. It requires
> `{ confirm: "KHOI PHUC" }` in the body and writes a `RESTORE_DATABASE` audit
> entry. It is irreversible and gated only by `settings.edit`.

## Permission matrix

The canonical module × action list is `PERMISSION_MODULES` in
`packages/shared/src/master-data.ts`:

| module | actions |
|---|---|
| dashboard | view |
| suppliers | view, edit |
| products | view, edit |
| orders | view, edit, approve, **viewPrice** |
| receipts | view, edit |
| payables | view, pay |
| payments | view |
| inventory | view, edit |
| reports | view |
| audit | view |
| users | view, edit |
| settings | view, edit |

`settings.view` and `receipts.view`-style entries exist in the matrix even where the
matching route currently has no `@RequirePermission`; `orders.viewPrice` is enforced
in the UI only. Both are noted in `docs/architecture.md` §8.
