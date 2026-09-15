# AGENTS.md

Canonical agent instructions live in **[CLAUDE.md](./CLAUDE.md)** — read it first.
This file adds the operational rules for making changes.

## Before you touch anything

1. The frontend is **Vite + React Router**, not Next.js. There is no `pages/` router,
   no server components, no `getServerSideProps`.
2. `apps/api/prisma/schema.prisma` is the source of truth for the data model —
   `packages/shared/src/enums.ts` has drifted from it (see CLAUDE.md).
3. Comments, UI copy and errors are in Vietnamese. Match that.

## Definition of done

A change is done when all of these pass locally:

```bash
npm run lint
npm run build                             # this is also the typecheck
npm run test --workspace apps/api         # domain unit tests
```

If the change touches the schema, additionally:

```bash
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name <snake_case_name>
npx prisma generate    --schema=apps/api/prisma/schema.prisma
```

If the change touches an order/receipt/payable/payment flow, run the matching
e2e spec against a disposable database (CI does **not** run these):

```bash
docker compose up -d postgres
npx jest --config apps/api/test/jest-e2e.config.js --rootDir apps/api <name>.e2e-spec
```

## Adding a backend endpoint — the checklist

1. DTO in `src/<mod>/dto/` with `class-validator` decorators. Undeclared fields 400.
2. Controller method with `@RequirePermission('<module>', '<action>')`. The class
   already carries `@UseGuards(JwtAuthGuard, PermissionGuard)`.
3. Service method: business logic, `deletedAt: null` filters, `AuditService.log()`
   on every mutation.
4. State transition? Wrap in `$transaction` + `SELECT ... FOR UPDATE` on the row.
5. Pure math? Put it in `src/domain/` with a `.spec.ts`.
6. Response type in `packages/shared/src/` and rebuild shared.
7. Document the route in `docs/api.md`.

## Adding a frontend screen — the checklist

1. Page in `src/pages/`, route in `src/App.tsx` inside the `RequireAuth` group.
2. Fetch wrapper in `src/api/<domain>.ts` using `apiGet/apiPost/...`.
3. Query key + hook in `src/hooks/queries.ts` — never inline `useQuery` with a
   literal key, and invalidate the right keys in mutations.
4. Gate UI with `useAuthStore().can(module, action)`, and gate the API too —
   `can()` alone is not security.
5. Styles go in `src/styles/global.css` (the single stylesheet) or inline style
   objects, matching what the neighbouring page does.

## New permission module/action

Four places must agree, or the UI shows a toggle that does nothing:

1. `@RequirePermission(...)` on the controller.
2. `PERMISSION_MODULES` in `packages/shared/src/master-data.ts`.
3. `MODULE_CONFIG` / `ACTION_CONFIG` in `apps/web/src/pages/UsersPage.tsx`.
4. Default grants for new STAFF in `apps/api/src/users/users.service.ts` and
   `apps/api/prisma/seed.ts`.

## Never

- `prisma db push` (migration-based repo), or editing an already-applied migration.
- `npm run prisma:seed` against a database with real data — it truncates everything.
- Committing `.env`, `*.sql` dumps, `apps/web/test-results/`.
- Trusting a price, total or amount sent from the client.
- Weakening `forbidNonWhitelisted`, the throttler on `/auth/login`, or the
  httpOnly refresh cookie.
- Adding a stored `status`/`balance` column to `payables`.
