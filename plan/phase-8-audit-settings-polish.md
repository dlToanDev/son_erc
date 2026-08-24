# Phase 8 — Audit · Settings · Hoàn thiện FE

**Mục tiêu:** Trải nghiệm & khả năng tra soát đầy đủ.

## Backend (API)

- [x] `GET /audit-logs` — nhật ký toàn hệ thống (phân trang server-side, lọc action/entityType/from/to, kèm tên user)
- [x] `GET/PUT /settings` — cấu hình hệ thống (singleton — đã làm từ Phase 3)

## Frontend

- [x] **Audit Log** — nhật ký toàn hệ thống, lọc theo 21 loại hành động + khoảng ngày, phân trang
- [x] **Cài đặt** — cơ sở, ngưỡng cảnh báo công nợ, đơn vị tiền (từ Phase 3)
- [x] Rà soát đủ **18 màn**: Login · Dashboard · NCC (list+detail) · Mặt hàng · Đặt hàng (list+detail) · Phiếu nhập (list+detail) · Công nợ (list+detail) · Thanh toán · Kho NXT · Thống kê · So sánh kỳ · Audit Log · Người dùng · Cài đặt
- [x] Loading / empty / error state trên mọi bảng (DataTable), phân trang audit, tìm kiếm NCC

## Kiểm thử

- [x] E2E API (Supertest): 8 suite / 81 test — auth, master data, orders, finance, inventory, reports, audit
- [x] Smoke test FE (Playwright/Chromium): login → dashboard → NCC → công nợ → audit → logout; sai mật khẩu; menu theo quyền staff

## Definition of Done

- Đủ 18 màn hoạt động ổn định.
- AuditLog truy vết được mọi hành động thay đổi.
- E2E / smoke test pass.
