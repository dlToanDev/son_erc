# Chi tiết đơn dạng cửa sổ + Thêm/bớt mặt hàng khi Duyệt/Nhận (cập nhật công nợ)

**Ngày:** 2026-09-13
**Trạng thái:** Đã duyệt thiết kế

## Mục tiêu

1. **Chi tiết đơn mở dạng cửa sổ (modal)** thay vì chuyển sang trang riêng — vẫn giữ route `/orders/:id` để mở link trực tiếp.
2. Trong cửa sổ **Duyệt** và **Nhận hàng**: cho **Admin thêm/bớt mặt hàng + sửa số lượng + sửa đơn giá**; số tiền tự **cập nhật vào công nợ** (phiếu nhập + payable). Non-admin xem read-only.

Backend **không cần sửa**: `OrdersService.update()` đã thay toàn bộ order items và resync phiếu nhập + công nợ; `receive()` sinh công nợ theo danh sách hiện tại của đơn.

## Tính năng A — OrderDetailModal

- **`components/OrderDetailModal.tsx`** (mới): `{ orderId, open, onClose }`. Bọc `<Modal size="xl">`. Chuyển toàn bộ nội dung `OrderDetailPage` hiện tại vào đây: dùng `useOrder(orderId)`, hiển thị thông tin đơn + bảng mặt hàng + banner công nợ + các nút thao tác. Các trạng thái loading / lỗi / staff-bị-chặn hiển thị trong thân modal.
  - Duyệt → `<ApproveOrderModal>`; Nhận hàng → `<ReceiveOrderModal>`; Thanh toán → `<PayOrderModal>` (giữ nguyên); Sửa / Xóa / Từ chối / Huỷ → giữ nguyên như trang cũ (edit đã hỗ trợ thêm/bớt/số lượng).
  - Sau khi Xóa thành công → gọi `onClose()` (OrdersPage/wrapper tự điều hướng nếu cần).
- **`pages/OrderDetailPage.tsx`**: rút gọn thành wrapper — `const { id } = useParams(); const nav = useNavigate();` → `<OrderDetailModal orderId={id} open onClose={() => nav('/orders')} />`.
- **`pages/OrdersPage.tsx`**: thêm state `detailOrderId`; nút **"Chi tiết"** set state (bỏ `navigate`); click hàng cũng mở modal thay vì chuyển trang; render `<OrderDetailModal orderId={detailOrderId ?? ''} open={!!detailOrderId} onClose={() => setDetailOrderId(null)} />`.

## Tính năng B — Editable items trong Duyệt/Nhận

- **`components/OrderItemsEditor.tsx`** (mới) thay `OrderItemsPriceTable` trong luồng Duyệt/Nhận:
  - Line shape: `{ key, productId, quantity, unitPrice }` (chuỗi cho input).
  - Props: `lines`, `setLines`, `products` (danh mục ACTIVE của NCC đơn), `editable` (Admin), `showPrice`.
  - `editable=true`: mỗi dòng có select mặt hàng (đổi/chọn), input số lượng, input đơn giá (chọn mặt hàng tự điền giá từ danh mục), nút xóa dòng; nút **"Thêm dòng"**. `editable=false`: bảng read-only (giữ giao diện `OrderItemsPriceTable`).
  - Helpers export: `orderToLines(order)`, `linesChanged(order, lines)`, `linesTotal(lines)`, `linesUpdateBody(lines, isAdmin)` (lọc dòng hợp lệ: có productId & quantity > 0; kèm `unitPrice` khi Admin), `hasValidLine(lines)`.
- **`components/ApproveOrderModal.tsx`** (mới): `{ order, open, onClose }`. `isAdmin` từ auth store; `products = useProducts(order?.supplierId)`; `lines` init từ order khi mở; `{ approve, update } = useOrderMutations()`.
  - `doApprove`: nếu `isAdmin && linesChanged` → `update({ id, body: linesUpdateBody(lines, true) })`; rồi `approve(id)`; `onClose()`. Chặn nếu không còn dòng hợp lệ.
- **`components/ReceiveOrderModal.tsx`** (mới): như trên + input **hạn thanh toán** (mặc định +30 ngày). `doReceive`: (admin+đổi → update trước) → `receive({ id, dueDate })`. Tổng hiển thị = "CÔNG NỢ PHÁT SINH".
- **`OrdersPage`** dùng `ApproveOrderModal` + `ReceiveOrderModal` thay 2 modal inline hiện tại (state đổi thành `orderToApprove`/`orderToReceive` truyền vào component; bỏ `prices`/`initPriceMap`/`pricesChanged`/`pricedUpdateBody` cục bộ và các `useEffect` liên quan).

## Ràng buộc / Edge cases

- Chỉ Admin thêm/bớt/sửa giá (backend đã chặn sửa đơn APPROVED và sửa giá cho non-admin). Non-admin: editor read-only.
- Thêm dòng chỉ chọn được mặt hàng thuộc danh mục ACTIVE của NCC đơn (backend validate productId thuộc supplier).
- Phải còn ≥ 1 mặt hàng hợp lệ mới cho Duyệt/Nhận.
- Modal lồng modal (Chi tiết → Duyệt/Sửa): z-index `.modal-backdrop` = 10000 dùng chung, modal mở sau nằm trên — đã kiểm tra OK.
- `useProducts('')` khi chưa có order → không gọi (hook `enabled: !!supplierId`).

## Không làm

- Không đổi backend.
- Không bỏ route `/orders/:id`.
- `OrderItemsPriceTable` có thể giữ lại (đường lui) hoặc xóa nếu không còn tham chiếu.
