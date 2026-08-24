# Phase 3 — Master data (Danh mục nền)

**Mục tiêu:** Dữ liệu gốc để nghiệp vụ vận hành.

## Backend (API)

- [x] `GET/POST/PATCH /facilities` — cơ sở / chi nhánh (GET: mọi user đăng nhập)
- [x] `GET/POST/PATCH /suppliers` · `GET /suppliers/:id` (tổng công nợ runtime từ InvoiceCalculator)
- [x] `GET/POST/PATCH /suppliers/:id/products` — danh mục + giá
- [x] `GET/POST/PATCH /users` · `PUT /users/:id/permissions` — phân quyền (transaction, chặn tự khoá)
- [x] `GET/PUT /settings` (kéo lên từ Phase 8 vì trang Cài đặt cần)
- [x] AuditService — mọi thao tác ghi audit log

## Frontend (Pages)

- [x] **Nhà cung cấp (list)** — tìm kiếm, tổng phát sinh / còn nợ / quá hạn mỗi NCC, thêm/sửa/ẩn
- [x] **Chi tiết NCC** — khung 4 tab: Mặt hàng (hoạt động) · Phiếu nhập · Công nợ · Thanh toán (placeholder Phase 5)
- [x] **Mặt hàng** — chọn NCC → danh mục + giá (lịch sử nhập theo giá: Phase 5)
- [x] **Người dùng** — quản lý user & ma trận phân quyền module/action
- [x] **Cài đặt** — cơ sở (thêm/sửa/ẩn), ngưỡng cảnh báo công nợ, đơn vị tiền

## Hạ tầng FE dùng chung

- [x] Chuẩn hoá TanStack Query (`hooks/queries.ts` — queryKey + invalidate tập trung)
- [x] Component dùng chung: `DataTable`, `Modal`, `Layout` (sidebar), `ProductsPanel`
- [x] UI/UX DebtFlow: sidebar xanh đậm, badge màu, không gradient trong app

## Definition of Done

- Tạo / sửa / ẩn được NCC – cơ sở – mặt hàng – user.
- Phân quyền staff áp dụng thực tế lên UI và API.
