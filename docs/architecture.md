# Architecture — DebtFlow

Describes the system **as it exists**. Anything not implemented is called out as a gap.

## 1. Overview

DebtFlow manages purchasing and supplier payables across multiple facilities
(cơ sở). One npm-workspaces monorepo, two deployable apps + one shared type package.

```
Browser ──► nginx (prod) ──► /            static SPA bundle (apps/web)
                         └──► /api/v1/*   NestJS (apps/api) ──► PostgreSQL 16
                                                     ▲
                                             backup sidecar (pg_dump → /backups → rclone)
```

In development there is no nginx: Vite's dev server proxies `/api` to
`http://localhost:3000` (`apps/web/vite.config.ts`), so the browser sees a single
origin in both environments. This is why the refresh cookie (`path=/api/v1/auth`)
works without cross-site cookie configuration.

## 2. Repository structure

| Path | Role |
|---|---|
| `apps/api` | NestJS 10 backend |
| `apps/web` | Vite 6 + React 18 SPA |
| `packages/shared` | `@debtflow/shared` — TS interfaces, enums, permission matrix |
| `plan/` | Historical phase-by-phase build plan (phase-0 … phase-9) |
| `docs/` | This documentation + design specs + e2e reports |
| `deploy/`, `nginx/`, `docker-compose*.yml` | Ops |

`packages/shared` is consumed two different ways: the API imports the **built**
`dist/` (so it must be built before the API compiles), while Vite aliases
`@debtflow/shared` straight to `packages/shared/src` to avoid CJS named-export
problems in Rollup.

## 3. Backend architecture

Classic NestJS module-per-domain. `AppModule` imports:
`Prisma, Audit, Health, Auth, Facilities, Settings, Suppliers, Users, Orders,
Receipts, Payables, Payments, Inventory, Reports`.

Layering inside a module:

```
<mod>.controller.ts   HTTP + DTO validation + @RequirePermission
<mod>.service.ts      business logic, Prisma access, audit logging
dto/<mod>.dto.ts      class-validator DTOs
```

Cross-cutting pieces:

- `src/prisma/prisma.service.ts` — `PrismaClient` subclass with connect/disconnect
  lifecycle hooks; injected everywhere. No repository layer.
- `src/domain/` — **pure, dependency-free calculators**, the only unit-tested code:
  - `invoice.calculator.ts` — `invoiceBalance`, `invoiceStatus` (runtime payable state)
  - `purchase-totals.calculator.ts` — line totals, discount, tax, grand total
  - `period.calculator.ts` — `periodBounds`, `previousPeriodBounds`, `percentChange`
  - `inventory.ledger.ts` — opening/in/out/closing
  - `date-utils.ts`
- `src/common/codes.ts` — document codes `DH-YYYY-NNN`, `PN-YYYY-NNN`, `PX-YYYY-NNN`.
- `src/audit/audit.service.ts` — append-only audit log, called by every mutation.
- `src/backup/backup.service.ts` — lists `/backups/debtflow-*.sql.gz` and can restore
  the newest one by shelling out to `gunzip | psql`.

`main.ts`: `cookie-parser`, global prefix `api/v1`, global `ValidationPipe
({ whitelist, transform, forbidNonWhitelisted })`, CORS from `CORS_ORIGIN`.
Global `ThrottlerModule` at 100 req/min; `/auth/login` tightened to 5/min.

### Concurrency

State transitions use pessimistic locking inside a Prisma interactive transaction:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
  // re-read status, validate, mutate
});
```

Used in `orders` (approve/receive/pay/cancel/delete), `receipts.confirm`,
`payments` (create/void) and `inventory` (create/update/cancel). This is the
project's standard and should be followed by any new transition.

### Business flow

```
PurchaseOrder(PENDING)
   ├─ reject  → REJECTED
   ├─ cancel  → CANCELLED
   └─ approve → APPROVED
        └─ receive → RECEIVED  + creates PurchaseReceipt(CONFIRMED) + Payable
                                 (dueDate = receipt date + 30 days)
             └─ pay → PAID     + creates Payment
```

Receiving is where money is created: the receipt snapshots items, the payable
snapshots the total. Payables carry **no** status column — `UNPAID / PARTIAL /
PAID / OVERDUE` is derived on every read from the payment rows and `dueDate`.

## 4. Frontend architecture

Single-page app, no SSR, no code splitting.

- `main.tsx` — `QueryClientProvider` (default options, no retry/staleTime tuning)
  + `App`.
- `App.tsx` — `BrowserRouter`; `/login` and `/mobile` are public, everything else
  is nested under `<RequireAuth><Layout/></RequireAuth>`. `/` resolves to the
  dashboard or redirects to `/orders` depending on `can('dashboard','view')`.
- `components/RequireAuth.tsx` — on cold start calls `tryRefresh()` once to restore
  the session from the httpOnly refresh cookie, shows a boot screen meanwhile.
- `store/auth.ts` (Zustand) — `user`, `accessToken` (**in memory only**, lost on
  reload by design), `can(module, action)`.
- `api/client.ts` — the only place that calls `fetch`. Adds `Authorization: Bearer`,
  `credentials: 'include'`, and on a 401 (outside `/auth/*`) refreshes once and
  retries, else clears the store. Errors become `ApiError(status, message)`.
- `api/*.ts` — one thin module per domain, returning `@debtflow/shared` types.
- `hooks/queries.ts` — the central `keys` registry plus every `useQuery` /
  `useMutation` hook, with invalidation wired in `onSuccess`.
- `pages/` — one component per route; several are very large
  (`SupplierDetailPage` 1500 lines, `InventoryPage` 1410).
- Styling: one global stylesheet plus inline style objects. Charts are hand-rolled
  SVG components.

## 5. Authentication & authorization

**Authentication** — JWT, two tokens:

| Token | Lifetime | Transport | Secret |
|---|---|---|---|
| access | `JWT_ACCESS_TTL` (15m) | `Authorization: Bearer`, held in Zustand memory | `JWT_ACCESS_SECRET` |
| refresh | `JWT_REFRESH_TTL` (7d) | httpOnly cookie `refresh_token`, `path=/api/v1/auth`, `sameSite=lax`, `secure` in production | `JWT_REFRESH_SECRET` |

Passwords are bcrypt (cost 10). Login is rate-limited and returns a single generic
message for both unknown email and wrong password. `POST /auth/refresh` verifies
the refresh token, checks the user is still `ACTIVE`, and rotates both tokens.

**Authorization** — two independent mechanisms:

1. `role`: `ADMIN` bypasses every permission check; `STAFF` does not.
2. `staff_permissions(user_id, module, action, allowed)` — checked by
   `PermissionGuard` against `@RequirePermission(module, action)`.

An endpoint **without** `@RequirePermission` only requires a valid login. Today that
includes `GET /facilities`, `GET /suppliers`, `GET /suppliers/:id/products`,
`GET /settings` and `GET /health`.

Frontend `can()` mirrors the same rule but is presentation only.

## 6. Testing

| Kind | Where | Runs in CI |
|---|---|---|
| Unit (pure domain + auth + health) | `apps/api/src/**/*.spec.ts` (6 files) | yes |
| API e2e (needs live Postgres) | `apps/api/test/*.e2e-spec.ts` (8 files) | **no** |
| Browser smoke | `apps/web/e2e/smoke.spec.ts` (Playwright) | **no** |

`apps/web`'s `npm test` is a stub that prints a message and exits 0.
There are **no** frontend unit/component tests and no coverage gate.

CI (`.github/workflows/ci.yml`): install → `prisma generate` → build shared →
`npm run lint` → `npm run test` → build both Docker images.

## 7. Deployment

`docker-compose.prod.yml`: `postgres` + `api` (Nest, `migrate deploy` via
`docker-entrypoint.sh`) + `nginx` (serves the built SPA and proxies `/api`) +
a backup sidecar that runs `pg_dump` daily into the `backups` volume and pushes
offsite with rclone. TLS via Let's Encrypt (`deploy/init-letsencrypt.sh`).
See `DEPLOY.md` / `REDEPLOY.md`.

## 8. Known architectural problems

Ordered by impact. None of these are fixed in code — they are documented so agents
stop re-discovering them.

### Correctness / security

1. **`orders.viewPrice` is client-side only.** `GET /orders` and `GET /orders/:id`
   return `unitPrice` and `total` to any user holding `orders.view`; the React
   components merely hide them. A staff member reading the network tab sees all
   prices. Fix: strip money fields in `OrdersService.serialize` based on the caller.
2. **Shared enums have drifted from Prisma.** `packages/shared/src/enums.ts`
   `OrderStatus` lacks `RECEIVED`/`PAID`; `PaymentDirection` is `OUT|IN` while the
   DB enum is `PAYABLE|RECEIVABLE`. Anything switching on the shared enum is wrong.
3. **A real database dump is committed**: `backup-before-reset-20260913-225736.sql`
   at the repo root, containing business data and bcrypt password hashes. `.gitignore`
   covers `backups/` but not this file. Remove from the repo and rotate credentials.
4. **JWT secrets fall back to hard-coded dev strings** (`jwt.constants.ts`) and the
   dev `docker-compose.yml` does not pass `JWT_*` at all. Production compose does
   require them, so the risk is a misconfigured non-prod deployment. Fail fast
   instead of defaulting.
5. **`POST /settings/restore-latest` overwrites the entire database** from a file
   found by `readdir` on `BACKUP_DIR`, guarded only by `settings.edit` plus a typed
   confirm phrase. It shells out to `gunzip | psql`; the paths are JSON-quoted, but
   this is still a full destructive action behind a normal permission.
6. **All money math runs in JavaScript floats.** Services `Number()` every
   `Decimal` and add them up; `PaymentsService.create` even compares against the
   balance with a `1e-9` epsilon. Values are stored back into `Decimal(18,2)`, so
   rounding drift is bounded, but the calculators should use a decimal type.
7. **Audit `userId` has no foreign key**, so names are joined manually and a deleted
   user leaves dangling ids.

### Data integrity

8. **Document codes are racy.** `nextOrderCode` et al. use `count() + 1`, which both
   races under concurrency and collides after soft-deletes (deleted rows are counted
   while the unique index still holds the old code). Use a sequence or a per-year
   counter table.
9. **`purchase_orders.created_by/reviewed_by/received_by/paid_by`,
   `payables.created_by`, `payments.created_by` are plain strings, not FKs.**
10. **`Payment.direction` exists but nothing ever writes `RECEIVABLE`** — dead
   dimension in the schema.

### Performance

11. **No pagination anywhere except the audit log.** `GET /orders`, `/payables`,
    `/payments`, `/receipts`, `/inventory/issues` all `findMany` the whole table.
12. **N+1 in `OrdersService.serialize`** — one `user.findUnique` per order plus up
    to two more for receipt/payable codes. A 500-order list is ~1500 queries.
13. **Runtime payable status is computed in Node over every row.** `PayablesService
    .findAll` loads all payables with all payments, then filters by status *after*
    serialization; `ReportsService.dashboard` does the same over the full table.
14. **Almost no indexes.** The schema declares only `@unique`s plus one `@@index`
    on price history. Missing hot-path indexes: `purchase_orders(facility_id,
    status, deleted_at)`, `payables(supplier_id, deleted_at)`, `payments(payable_id,
    status)`, `purchase_receipts(receipt_date, facility_id)`, `audit_logs(time)`,
    `supplier_products(supplier_id)`.
15. **Frontend has no code splitting** and `QueryClient` uses stock defaults; the
    two 1400+ line pages ship on first load.

### Maintainability

16. Pages of 500–1500 lines mix data fetching, layout and business rules.
17. `apps/api/test/*.e2e-spec.ts` are the real behavioural safety net but nothing
    runs them automatically.
18. No OpenAPI/Swagger — `@nestjs/swagger` is not installed, so `docs/api.md` is
    hand-maintained and can rot.
19. No structured logging, no request ids, no error monitoring.
20. No `.nvmrc`; root says Node >= 20, CI uses 22.

## 9. Recommended next steps

1. Remove the committed dump; rotate any credential it contains.
2. Enforce `orders.viewPrice` server-side.
3. Regenerate `packages/shared/src/enums.ts` from the Prisma schema, or derive the
   types from `@prisma/client`.
4. Make missing `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` a startup failure.
5. Add the indexes in item 13 as one migration.
6. Replace `count()+1` code generation with a Postgres sequence.
7. Add pagination to the list endpoints, starting with orders and payables, and
   remove the N+1 in `serialize` by `include`-ing the creator and result documents.
8. Run the API e2e suite in CI against a `services: postgres` container.
9. Add a `typecheck` script (`tsc --noEmit`) to each workspace.
