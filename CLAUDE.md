# CLAUDE.md — DebtFlow

Working instructions for AI agents in this repository. Keep them accurate: if you
change the system, update this file and `docs/`.

## What this is

**DebtFlow** (package name `debtflow`, internal product name "Garden Chay") is a
multi-facility purchasing & supplier-payables system. Flow:

`PurchaseOrder → approve → receive (creates PurchaseReceipt + Payable) → pay (Payment)`
plus inventory issues (`InventoryIssue`), reports, audit log and RBAC.

**Language: the product, UI strings, code comments, commit messages and error
messages are Vietnamese.** Write new comments/messages in Vietnamese to match.
Identifiers stay English.

## Actual stack (verify before assuming)

| Layer | Reality |
|---|---|
| Frontend | **Vite 6 + React 18 + React Router 6** — **NOT Next.js**. SPA, no SSR. |
| FE state | TanStack Query v5 (server state) + Zustand (auth only) |
| Backend | NestJS 10 (Express), global prefix `/api/v1` |
| DB | PostgreSQL 16, Prisma 6 |
| Shared | `packages/shared` — plain TS types/enums, no runtime deps |
| Monorepo | npm workspaces (`apps/*`, `packages/*`). No Nx/Turbo. |
| Styling | one hand-written `apps/web/src/styles/global.css`. No Tailwind, no CSS modules. |
| Charts | hand-written `BarChart.tsx` / `PieChart.tsx`. No chart library. |

Node >= 20 (CI uses 22).

## Layout

```
apps/api/          NestJS — one folder per domain module
  src/<mod>/       <mod>.controller.ts | .service.ts | .module.ts | dto/
  src/domain/      PURE calculators, unit-tested (invoice, totals, period, inventory ledger)
  src/common/      codes.ts — document-code generation
  src/auth/        JWT strategy, guards, decorators
  prisma/          schema.prisma, migrations/, seed.ts
  test/            *.e2e-spec.ts (need a live DB; NOT run by CI)
apps/web/          Vite SPA
  src/api/         thin fetch wrappers over apiFetch
  src/hooks/queries.ts   ALL react-query keys + hooks, centralised
  src/pages/       one page per route
  src/components/  shared UI
packages/shared/   types + enums shared FE/BE
plan/              phase-by-phase build plan (historical)
docs/              architecture.md, database.md, api.md, development.md
```

## Commands

```bash
npm run dev                  # api + web concurrently
npm run build                # all workspaces
npm run lint                 # all workspaces (eslint)
npm run test                 # all workspaces → really only api jest unit tests

npm run test --workspace apps/api          # jest, *.spec.ts only
npm run build --workspace apps/web         # tsc -b && vite build  ← the typecheck
npm run test:smoke --workspace apps/web    # Playwright, needs stack running

npx prisma migrate dev  --schema=apps/api/prisma/schema.prisma
npx prisma generate     --schema=apps/api/prisma/schema.prisma
npm run prisma:seed --workspace apps/api   # DESTRUCTIVE: wipes all tables first
```

There is **no standalone typecheck script**. Typecheck = `npm run build`.
After editing `packages/shared`, run `npm run build --workspace packages/shared`
or the API won't see the new types (the web app aliases shared source directly, so
it picks up changes without a build).

## Hard rules

1. **Never trust client-supplied money.** Prices are snapshotted server-side from
   `supplier_products` (see `OrdersService.create`). Keep it that way.
2. **Payable status and balance are never stored.** They are computed at runtime
   from `payments` + `dueDate` by `src/domain/invoice.calculator.ts`. Do not add a
   `status` column to `payables`.
3. **Money = `Decimal(18,2)`, quantity = `Decimal(14,3)`.** Convert with `Number()`
   only at the serialization boundary, never mid-calculation across many rows.
4. **State transitions take a row lock.** The established pattern is
   `prisma.$transaction(tx => { await tx.$queryRaw\`SELECT id FROM <table> WHERE id = ${id} FOR UPDATE\`; ... })`.
   Any new approve/receive/pay/cancel path must do the same.
5. **Every mutation writes an audit log** via `AuditService.log(...)`. No exceptions.
6. **Authorization is `@RequirePermission(module, action)` on the controller**,
   with `@UseGuards(JwtAuthGuard, PermissionGuard)` at the class level.
   Frontend `can()` checks are cosmetic only.
7. **Soft delete**: `purchase_orders`, `purchase_receipts`, `payables` use
   `deletedAt`. Every query must include `deletedAt: null`. `payments` and
   `inventory_issues` use `status: CANCELLED` instead (soft-void).
8. **Don't put business math in services.** Pure functions go in `src/domain/` with
   a `.spec.ts` beside them; that is the only unit-tested layer.
9. **Never select `passwordHash`.** Use the `USER_SELECT` constant in `users.service.ts`.

## Conventions

- Services own business logic; controllers only validate + delegate.
- DTOs use `class-validator`; the global pipe runs `whitelist + forbidNonWhitelisted
  + transform`, so an undeclared field is a 400.
- Prisma models are PascalCase, tables/columns snake_case via `@map`.
- A shared `XXX_INCLUDE` const + `Prisma.XGetPayload<...>` type is the idiom for
  query shape reuse (`payables.service.ts`, `orders.service.ts`).
- Frontend: never call `fetch` directly — go through `src/api/client.ts`
  (`apiGet/apiPost/apiPut/apiDelete`), which attaches the bearer token and does a
  single refresh-and-retry on 401.
- Add react-query keys to `keys` in `src/hooks/queries.ts`, not inline.
- Prettier: single quotes, trailing commas, width 100, 2 spaces, semicolons.

## Things that are broken — don't copy them, and prefer fixing

- `packages/shared/src/enums.ts` **is out of sync with Prisma**: `OrderStatus` is
  missing `RECEIVED` and `PAID`; `PaymentDirection` says `OUT/IN` where the DB says
  `PAYABLE/RECEIVABLE`. Prisma is the source of truth.
- `orders.viewPrice` ("Xem tiền") is enforced **only in React**. The API returns
  `unitPrice`/`total` to anyone with `orders.view`.
- `src/common/codes.ts` generates codes with `count()+1` — racy, and soft-deleted
  rows are counted, so it can collide on the unique index.
- `OrdersService.serialize` issues up to 3 extra queries **per order** and list
  endpoints have no pagination.
- `backup-before-reset-20260913-225736.sql` is committed at the repo root and
  contains real data and bcrypt hashes. It should be removed from the repo.

See `docs/architecture.md` for the full list with reasoning.

## Do not

- Do not introduce Next.js, a UI kit, a chart library, or an ORM change.
- Do not run `prisma db push` — this project is migration-based; write a migration.
- Do not run the seed against anything but a throwaway dev database.
- Do not commit `.env`, dumps, or `apps/web/test-results/`.
