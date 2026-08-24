# DebtFlow — Kế hoạch thực hiện (Roadmap)

Hệ thống quản lý mua hàng & công nợ nhà cung cấp đa cơ sở.
Full-stack: **NestJS + Prisma + PostgreSQL 16 + React/Vite/TypeScript**.

## Nguyên tắc thực hiện

- **Backend-first theo chiều dọc (vertical slice):** mỗi phase nghiệp vụ làm trọn `DB → domain → service → API → FE` để luôn có phần chạy được, test được.
- **Kiến trúc phân tầng:** `Controller → Service → Repository (Prisma) → DB`.
- **Domain thuần tách khỏi framework:** `InvoiceCalculator`, `PurchaseTotalsCalculator`, `InventoryLedger`, `PeriodCalculator` — tái dùng & unit-test dễ.

## Bất biến cốt lõi (giữ xuyên suốt mọi phase)

- Duyệt đơn sinh **Receipt + Payable trong 1 transaction** (nguyên tử, rollback nếu lỗi).
- **Soft-void** — không xoá cứng dữ liệu tài chính.
- **Chặn xuất vượt tồn** khả dụng (`canIssue`).
- Giá đơn là **snapshot** lúc tạo, không đổi khi sửa danh mục sau.
- Mọi thao tác thay đổi ghi **AuditLog** (append-only).

## Danh sách phase

| Phase | Nội dung | File |
|-------|----------|------|
| 0 | Khởi tạo nền tảng (Foundation) | [phase-0-foundation.md](./phase-0-foundation.md) |
| 1 | Cơ sở dữ liệu & Domain thuần | [phase-1-database-domain.md](./phase-1-database-domain.md) |
| 2 | Auth + RBAC + Phân quyền | [phase-2-auth-rbac.md](./phase-2-auth-rbac.md) |
| 3 | Master data (Danh mục nền) | [phase-3-master-data.md](./phase-3-master-data.md) |
| 4 | Đặt hàng → Duyệt (luồng lõi) | [phase-4-orders-approval.md](./phase-4-orders-approval.md) |
| 5 | Phiếu nhập · Công nợ · Thanh toán | [phase-5-receipts-payables-payments.md](./phase-5-receipts-payables-payments.md) |
| 6 | Kho Nhập–Xuất–Tồn | [phase-6-inventory.md](./phase-6-inventory.md) |
| 7 | Báo cáo · Dashboard · So sánh kỳ | [phase-7-reports-dashboard.md](./phase-7-reports-dashboard.md) |
| 8 | Audit · Settings · Hoàn thiện FE | [phase-8-audit-settings-polish.md](./phase-8-audit-settings-polish.md) |
| 9 | Triển khai (Docker / Deploy) | [phase-9-deploy.md](./phase-9-deploy.md) |

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript, React Router, TanStack Query, Zustand.
- **Backend:** NestJS, class-validator/transformer, Passport-JWT.
- **ORM/DB:** Prisma + PostgreSQL 16 (`NUMERIC(18,2)` tiền, `NUMERIC(14,3)` số lượng).
- **Bảo mật:** JWT access + refresh, bcrypt, RBAC + Permission Guard.
- **Kiểm thử:** Jest/Vitest, Supertest, Playwright.
- **Hạ tầng:** Docker, docker-compose, Nginx, GitHub Actions.
