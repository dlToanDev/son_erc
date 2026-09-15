# Development — DebtFlow

Related docs: [architecture](./architecture.md) · [database](./database.md) ·
[api](./api.md). Deployment lives in `../SETUP.md`, `../DEPLOY.md`, `../REDEPLOY.md`.

## Prerequisites

- Node **>= 20** (CI uses 22; there is no `.nvmrc`)
- Docker + Docker Compose (for PostgreSQL 16)
- npm (workspaces — do not use yarn/pnpm here)

## First run

```bash
cp .env.example .env
npm install                                              # root — installs all workspaces
docker compose up -d postgres                            # Postgres on host port 5443
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npx prisma generate       --schema=apps/api/prisma/schema.prisma
npm run build --workspace packages/shared                # the API needs shared/dist
npm run prisma:seed --workspace apps/api                 # optional, DESTRUCTIVE
npm run dev                                              # api :3000 + web :5173
```

Open http://localhost:5173. Seeded logins: `admin@debtflow.local / admin123`,
`staff1@debtflow.local / staff123` (staff sees only the ordering screens).

Running everything in containers instead: `docker compose up -d` starts postgres,
api and web with source mounted and hot reload. Note the dev compose file does
**not** pass `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, so the hard-coded dev
defaults in `apps/api/src/auth/jwt.constants.ts` are used.

`DATABASE_URL` in `.env.example` points at the `postgres` hostname (container
network). Running the API on the host instead, use
`postgresql://debtflow:debtflow_dev_pw@localhost:5443/debtflow?schema=public`.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api, prisma | |
| `API_PORT` | api | default 3000 |
| `CORS_ORIGIN` | api | comma-separated; **unset means allow any origin** |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | api | falls back to a dev constant — always set these outside local dev |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | api | `15m` / `7d` |
| `BACKUP_DIR` | api | default `/backups`, read-only mount in production |
| `WEB_PORT` / `API_PROXY_TARGET` | vite dev server | |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seed | |

`.env` is gitignored. See `.env.production.example` for the production set.

## Commands

| Task | Command |
|---|---|
| Run everything | `npm run dev` |
| API only | `npm run dev:api` |
| Web only | `npm run dev:web` |
| Build all | `npm run build` |
| Lint all | `npm run lint` |
| Test all | `npm run test` |
| **Typecheck** | `npm run build` — there is no separate typecheck script |
| API unit tests | `npm run test --workspace apps/api` |
| API e2e | `npx jest --config apps/api/test/jest-e2e.config.js --rootDir apps/api` |
| Browser smoke | `npm run test:smoke --workspace apps/web` (stack must be running) |
| New migration | `npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name <snake_case>` |
| Apply migrations | `npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma` |
| Regenerate client | `npx prisma generate --schema=apps/api/prisma/schema.prisma` |
| Prisma Studio | `npx prisma studio --schema=apps/api/prisma/schema.prisma` |
| Reseed (destructive) | `npm run prisma:seed --workspace apps/api` |

`npm run test` at the root reaches only `apps/api` in practice — `apps/web` and
`packages/shared` have placeholder test scripts that print a message and exit 0.

## Working on `packages/shared`

The two consumers resolve it differently:

- **API** imports the compiled `dist/` → run `npm run build --workspace packages/shared`
  after any change, or the API build fails with stale types.
- **Web** aliases `@debtflow/shared` to `packages/shared/src` in `vite.config.ts`
  → changes are picked up by HMR with no build step.

## Testing layout

| Suite | Files | Needs a DB | In CI |
|---|---|---|---|
| Domain/unit | `apps/api/src/**/*.spec.ts` — invoice, purchase totals, period, inventory ledger, auth, health | no | ✅ |
| API e2e | `apps/api/test/*.e2e-spec.ts` — auth, orders, finance, inventory, reports, master-data, audit, health | yes | ❌ |
| Smoke | `apps/web/e2e/smoke.spec.ts` | full stack | ❌ |

Unit tests use `apps/api/jest.config.js` (`testRegex: .*\.spec\.ts$`, which does not
match `-e2e-spec.ts`); e2e uses `apps/api/test/jest-e2e.config.js`.

**Gaps worth filling:** no frontend tests of any kind (`api/client.ts` refresh-retry,
the `can()` permission logic and the large pages are all untested), no test for
`PermissionGuard`, `BackupService` or `common/codes.ts`, no coverage threshold, and
the e2e suites — the only end-to-end safety net for the money flows — are not
automated. Run them manually before touching orders/receipts/payables/payments;
`apps/api/test/run-e2e-report.sh` writes a report into `docs/test-reports/`.

## Code style

Enforced by root `.eslintrc.json` (`@typescript-eslint/recommended` + `prettier`)
and `.prettierrc.json` (single quotes, trailing commas, width 100, 2 spaces, semis).
`no-explicit-any` and `no-unused-vars` are **warnings**, not errors — CI will not
stop you, so keep the diff clean yourself. `_`-prefixed names are exempt from the
unused check. `tsconfig.base.json` is `strict`.

Unwritten conventions the codebase actually follows:

- Vietnamese doc comments above services, guards and non-obvious logic.
- Controllers stay thin; all logic lives in the service.
- A shared `XXX_INCLUDE` const + `Prisma.XGetPayload<typeof XXX_INCLUDE>` type for
  reused query shapes.
- Explicit `serialize()` methods converting `Decimal → number` and `Date → ISO`
  at the service boundary.
- On the frontend: no direct `fetch`, query keys centralised in
  `src/hooks/queries.ts`, styles in the single `global.css`.

## Git

- Branch `main`; conventional-commit prefixes with Vietnamese subjects, e.g.
  `feat(rbac): thêm quyền 'Xem tiền'`, `fix(db): migration bù cho vòng đời đơn`.
- Never commit: `.env`, `*.sql` dumps, `deploy/rclone.conf`, `apps/web/test-results/`.
  (`backup-before-reset-20260913-225736.sql` and `apps/web/test-results/.last-run.json`
  are currently tracked and should be removed.)

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| API fails to compile on `@debtflow/shared` types | rebuild shared: `npm run build --workspace packages/shared` |
| `PrismaClient` missing a model or enum value | `npx prisma generate --schema=apps/api/prisma/schema.prisma` |
| 400 on a request that looks correct | `forbidNonWhitelisted` — an extra body field, or a field missing from the DTO |
| Logged out on every page refresh | expected: the access token lives in memory; check that the `refresh_token` cookie is present on `/api/v1/auth` |
| 401 loops in the browser | the refresh cookie is `sameSite=lax`, `path=/api/v1/auth`, and `secure` in production — it will not survive a cross-origin or plain-HTTP production setup |
| 429 on login | login throttle is 5/min per IP |
| `P2002` unique violation on a document code | `common/codes.ts` uses `count()+1`, which collides after soft deletes or under concurrency |
| Enum value missing in Postgres | enum changes need their own `ALTER TYPE ... ADD VALUE` migration |
| Schema and migrations disagree | someone ran `prisma db push`; write a catch-up migration as `20260912000000_order_lifecycle_status` does |
