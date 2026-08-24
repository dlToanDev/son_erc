# Phase 1 — Cơ sở dữ liệu & Domain thuần

**Mục tiêu:** Toàn bộ schema + logic nghiệp vụ thuần (không I/O) — nền cho mọi phase sau.

## Công việc

### Database (Prisma schema)

- [x] Viết `schema.prisma` đầy đủ 14 bảng:
  - `users`, `staff_permissions`, `facilities`, `suppliers`, `supplier_products`
  - `purchase_orders`, `order_items`, `purchase_receipts`, `receipt_items`
  - `payables`, `payments`, `inventory_issues`, `issue_items`
  - `audit_logs`, `settings`
- [x] Kiểu dữ liệu tiền: `Decimal(18,2)`; số lượng: `Decimal(14,3)` (hỗ trợ 12.5 kg)
- [x] Khoá ngoại ràng buộc toàn vẹn
- [x] Enum trạng thái: `OrderStatus { PENDING APPROVED REJECTED CANCELLED }`, ...
- [x] Migration ban đầu (`prisma migrate` — `20260821133647_init`)
- [x] **Seed script:** tạo admin đầu tiên + dữ liệu mẫu

### Domain thuần (port từ `logic.js`)

Đặt tại `apps/api/src/domain/`, **không phụ thuộc framework**, kèm unit test:

- [x] `InvoiceCalculator` — `invoiceBalance()`, `invoiceStatus()`
- [x] `PurchaseTotalsCalculator` — tạm tính, giảm giá, VAT, tổng
- [x] `InventoryLedger` — `inventoryReport()`, `canIssue()` (chặn xuất vượt tồn)
- [x] `PeriodCalculator` — `periodBounds()`, `previousPeriodBounds()`, `percentChange()`

## State machines cần mô hình hoá

| Thực thể | Chuyển tiếp |
|----------|-------------|
| PurchaseOrder | PENDING → APPROVED (sinh Receipt+Payable) / REJECTED / CANCELLED |
| PurchaseReceipt | DRAFT → CONFIRMED (sinh Payable) |
| Payable | UNPAID / PARTIAL / PAID / OVERDUE (tính runtime từ Payments & dueDate) |
| Payment / InventoryIssue | ACTIVE → CANCELLED (soft-void, hoàn số dư/tồn) |

## Definition of Done

- `prisma migrate` chạy sạch trên DB trống.
- Seed tạo được admin đăng nhập.
- Unit test domain 100% pass (giữ nguyên công thức đã kiểm thử ở demo).
