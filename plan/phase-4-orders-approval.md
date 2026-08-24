# Phase 4 — Đặt hàng → Duyệt (luồng lõi, transaction)

**Mục tiêu:** Nghiệp vụ trung tâm với toàn vẹn tài chính.

## Backend (API)

- [x] `GET/POST /orders` — danh sách (lọc cơ sở/trạng thái) + tạo đơn (snapshot server-side)
- [x] `GET /orders/:id` — chi tiết · `GET /orders/pending-count` — badge sidebar
- [x] `POST /orders/:id/approve` — duyệt (quyền `orders.approve`)
- [x] `POST /orders/:id/reject` — từ chối (kèm lý do, validate)
- [x] `POST /orders/:id/cancel` — huỷ (staff huỷ khi chưa duyệt)

## Luồng duyệt đơn — TRONG 1 TRANSACTION

`POST /api/v1/orders/:id/approve`:

1. Đọc order (khoá dòng), kiểm tra `status == PENDING`
2. Tạo `PurchaseReceipt(CONFIRMED)` từ `order.items`
3. Tạo `Payable(totalAmount)` gắn receipt
4. Cập nhật order: `status=APPROVED`, `result_receipt_id`, `result_payable_id`
5. Ghi `AuditLog(action=APPROVE_ORDER)`
6. Trả `200 { order, receipt, payable }` — **hoặc rollback toàn bộ nếu lỗi**

## Quy tắc nghiệp vụ

- State machine: PENDING → APPROVED / REJECTED / CANCELLED
- Giá đơn là **snapshot** lúc tạo (không đổi khi sửa danh mục NCC sau)

## Frontend

- [x] **Đặt hàng (list)** — lọc theo cơ sở + trạng thái
- [x] Tạo đơn — chọn cơ sở + NCC, chọn mặt hàng, nhập số lượng (giá snapshot tự điền)
- [x] Chi tiết đơn — duyệt / từ chối (modal lý do) / huỷ, banner kết quả duyệt
- [x] Sidebar admin hiện **số đơn chờ duyệt** (refetch 30s)

## Definition of Done

- Duyệt đơn sinh đúng Receipt + Payable **nguyên tử**.
- Lỗi giữa chừng rollback sạch, không để lại dữ liệu rác.
- AuditLog ghi đủ mọi hành động duyệt/từ chối/huỷ.
