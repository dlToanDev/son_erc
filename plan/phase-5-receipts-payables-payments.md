# Phase 5 — Phiếu nhập · Công nợ · Thanh toán

**Mục tiêu:** Vòng đời tài chính hoàn chỉnh.

## Phiếu nhập trực tiếp

- [x] `GET/POST /receipts` — tạo phiếu nhập DRAFT nhiều dòng (tên hàng, ĐVT, SL, đơn giá, giảm giá, VAT)
- [x] `POST /receipts/:id/confirm` — DRAFT → CONFIRMED → sinh **Payable** trong 1 transaction + audit (invoiceCode ưu tiên số HĐ NCC)

## Công nợ (Payables)

- [x] `GET /payables` — danh sách phải trả (balance/status tính sẵn, lọc theo status runtime + supplierId)
- [x] `GET /payables/:id` — chi tiết kèm lịch sử thanh toán
- [x] **Trạng thái tính runtime** theo payments/ngày, KHÔNG lưu cứng:
  - UNPAID / PARTIAL / PAID / OVERDUE (suy ra từ Payments & dueDate qua `invoiceStatus`)

## Thanh toán (Payments)

- [x] `POST /payments` — tạo thanh toán (một phần / đủ), khoá dòng chặn trả vượt số dư
- [x] `POST /payments/:id/void` — **soft-void**: hoàn số dư + ghi audit (không xoá cứng)
- [x] `GET /payments` — lịch sử thanh toán (lọc payableId/supplierId)

## Frontend

- [x] **Phiếu nhập** — list (lọc cơ sở/trạng thái), tạo nhiều dòng + giảm giá/VAT, chi tiết, xác nhận
- [x] **Công nợ** — list phải trả (badge 4 trạng thái + tổng còn nợ), chi tiết + tạo thanh toán
- [x] **Lịch sử thanh toán** — danh sách + huỷ (void) giao dịch
- [x] 3 tab còn lại của **Chi tiết NCC** (Phiếu nhập · Công nợ · Thanh toán) hoạt động

## Definition of Done

- Trạng thái công nợ tự chuyển đúng: UNPAID → PARTIAL → PAID theo thanh toán.
- Void hoàn số dư chính xác, trạng thái cập nhật lại.
- Mọi thao tác tài chính có AuditLog.
