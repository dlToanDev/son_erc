


































































































# Phase 0 — Khởi tạo nền tảng (Foundation)

**Mục tiêu:** Dựng monorepo + môi trường dev chạy được end-to-end (rỗng).

## Công việc

- [x] Tạo cấu trúc monorepo:
  - `apps/api/` — NestJS backend
  - `apps/web/` — React + Vite + TypeScript
  - `packages/shared/` — types & enums dùng chung FE+BE
- [x] Docker-compose dev: PostgreSQL 16 + api + web
- [x] File `.env` mẫu (`.env.example`): DB URL, JWT secret, cổng dịch vụ
- [x] Chuẩn hoá công cụ: ESLint + Prettier, `tsconfig` gốc, Jest/Vitest
- [x] GitHub Actions skeleton: `lint → test`
- [x] Prisma khởi tạo kết nối DB
- [x] Health-check endpoint `GET /api/v1/health`

## Cấu trúc thư mục mục tiêu

```
debtflow/
├── apps/api/          # NestJS backend
│   └── src/
│       ├── auth/  users/  facilities/  suppliers/
│       ├── orders/  receipts/  payables/  payments/
│       ├── inventory/  reports/  audit/  settings/
│       ├── domain/    # logic thuần: calculators, ledger
│       └── prisma/    # PrismaService
│   └── prisma/schema.prisma
├── apps/web/          # React frontend
│   └── src/{pages, components, api, store, styles}
├── packages/shared/   # types & enums dùng chung
├── docker-compose.yml
└── nginx/  .github/workflows/
```

## Definition of Done

- `docker-compose up` chạy được cả 3 dịch vụ.
- FE gọi được `/api/v1/health` trả 200.
- CI (lint + test) xanh trên commit đầu tiên.


ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK82NI3IExiKtUWtYzPjXwoGqomP8A+4U35OMwsdb3RO <your_email@example.com>
