# Xóa đơn hàng (soft-delete) — Admin-only, xác nhận kỹ

**Ngày:** 2026-09-13
**Trạng thái:** Đã duyệt thiết kế

## Mục tiêu

Cho phép **Admin** xóa một đơn hàng. Đơn đã xóa phải **biến mất hoàn toàn** khỏi:

- Danh sách đơn hàng, chi tiết đơn
- Báo cáo / thống kê (dashboard, stats, compare)
- Công nợ (payables) và cảnh báo công nợ
- Lịch sử thanh toán, danh sách phiếu nhập, sổ kho

Chỉ Admin mới xóa được. Khi bấm xóa, hệ thống hiển thị **cảnh báo kỹ**, người dùng phải **tick checkbox xác nhận** rồi mới thực hiện xóa.

## Nguyên tắc: Soft-delete

Xóa **mềm** — đánh dấu `deletedAt` / `deletedBy`, **không** xóa cứng dữ liệu. Khớp triết lý soft-void sẵn có của hệ thống (`Payment`, `InventoryIssue` dùng `RecordStatus.CANCELLED`; `Payable.status` tính runtime). Dữ liệu vẫn nằm trong DB để truy vết. Không làm trang khôi phục ở phạm vi này (khôi phục thủ công = clear 2 cột nếu cần sau này).

Vì báo cáo đọc thẳng từ `PurchaseReceipt` (status `CONFIRMED`) và công nợ đọc thẳng từ `Payable` — **không** đi qua `PurchaseOrder` — nên phải đánh dấu xóa trên **cả 3 model** liên kết, đồng thời thêm filter loại trừ ở mọi query site đọc chúng.

## 1. Schema (Prisma migration)

Thêm 2 cột vào 3 model:

```prisma
deletedAt DateTime? @map("deleted_at")
deletedBy String?   @map("deleted_by")
```

- `PurchaseOrder`
- `PurchaseReceipt`
- `Payable`

Tạo migration mới (`prisma migrate dev`). Không có index đặc biệt (bảng nhỏ, filter `deletedAt: null` chấp nhận được).

## 2. Backend — `OrdersService.remove(id, user)`

Chữ ký: `remove(id: string, user: RequestUser): Promise<{ id: string }>`

Logic:

1. **Chặn quyền:** nếu `user.role !== 'ADMIN'` → `ForbiddenException('Chỉ Admin mới có quyền xóa đơn hàng')` (giống pattern check role trong `update()`).
2. Nạp order (`findUnique` include items) — không thấy hoặc `deletedAt != null` → `NotFoundException('Không tìm thấy đơn hàng')`.
3. Trong **1 transaction**:
   - Khóa dòng: `SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`.
   - `now = new Date()`.
   - Set `deletedAt=now, deletedBy=user.id` cho `PurchaseOrder`.
   - Nếu `order.resultReceiptId` → set `deletedAt/deletedBy` cho `PurchaseReceipt` đó.
   - Nếu `order.resultPayableId` → set `deletedAt/deletedBy` cho `Payable` đó.
   - Ghi `AuditLog`:
     - `action: 'DELETE_ORDER'`, `entityType: 'ORDER'`, `entityId: id`
     - `detail`: snapshot gồm mã đơn, trạng thái, tổng tiền, và ghi rõ có kéo theo công nợ / phiếu nhập hay không.
       Ví dụ: `Xóa đơn PO-000123 (RECEIVED), tổng 5.000.000đ — kèm phiếu nhập PN-... + công nợ CN-...`
4. Trả `{ id }`.

**Controller:** thêm endpoint

```ts
@Delete(':id')
@RequirePermission('orders', 'edit')
remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
  return this.orders.remove(id, user);
}
```

(Quyền admin kiểm trong service; `@RequirePermission('orders','edit')` là hàng rào tối thiểu ở controller. Nhớ import `Delete` từ `@nestjs/common`.)

## 3. Backend — filter `deletedAt: null` tại các query site

Đây là phần cốt lõi để đơn đã xóa biến mất khắp nơi.

### Loại trừ theo `PurchaseOrder.deletedAt`

| File | Hàm / dòng | Thêm |
|---|---|---|
| `orders/orders.service.ts` | `findAll` (where) | `deletedAt: null` |
| `orders/orders.service.ts` | `findOne` (where) | `deletedAt: null` |
| `orders/orders.service.ts` | `pendingCount` (where) | `deletedAt: null` |

> `findOne` dùng `findUnique` (chỉ nhận unique field trong where) → đổi sang `findFirst({ where: { id, deletedAt: null } })` để lọc được `deletedAt`. Tương tự nếu `findAll` cần.

### Loại trừ theo `PurchaseReceipt.deletedAt`

| File | Hàm / dòng | Thêm |
|---|---|---|
| `reports/reports.service.ts` | `loadReceipts` (l.294) | `deletedAt: null` |
| `reports/reports.service.ts` | `aggregateItems` (l.323) | `deletedAt: null` |
| `receipts/receipts.service.ts` | `findAll` (l.39) | `deletedAt: null` |
| `receipts/receipts.service.ts` | `findOne` (l.52) | `deletedAt: null` (đổi `findUnique` → `findFirst`) |
| `inventory/inventory.service.ts` | `loadLedger` (l.331) | `deletedAt: null` (gộp vào `where`) |

### Loại trừ theo `Payable.deletedAt`

| File | Hàm / dòng | Thêm |
|---|---|---|
| `payables/payables.service.ts` | `findAll` (l.26) | `deletedAt: null` |
| `payables/payables.service.ts` | `findOne` (l.37) | `deletedAt: null` (đổi `findUnique` → `findFirst`) |
| `reports/reports.service.ts` | dashboard outstanding (l.73) | `deletedAt: null` |
| `reports/reports.service.ts` | `buildDebtAlerts` (l.171) | `deletedAt: null` (giữ điều kiện `dueDate: { not: null }`) |

### Loại trừ payment thuộc payable đã xóa

| File | Hàm / dòng | Thêm |
|---|---|---|
| `reports/reports.service.ts` | `sumPayments` (l.311, KPI "đã trả") | `payable: { deletedAt: null }` |
| `payments/payments.service.ts` | `findAll` (l.29, lịch sử thanh toán) | `payable: { deletedAt: null }` |

### Giữ nguyên (cố ý)

- `common/codes.ts` `count` (đánh số chứng từ) — vẫn đếm cả bản ghi đã xóa để **không trùng mã** khi cấp mã mới.
- Các `findUnique` nội bộ của chính order đang xử lý (`orders.service` l.300/544/551, `payments.service` l.49) — thuộc luồng của bản ghi cụ thể, order đã bị loại ở tầng list/detail nên không rò rỉ.

## 4. Frontend

### API client

- `api/client.ts`: thêm
  ```ts
  export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });
  ```
- `api/orders.ts`: thêm
  ```ts
  export const deleteOrder = (id: string) => apiDelete<{ id: string }>(`/orders/${id}`);
  ```

### Hook

`hooks/queries.ts` → `useOrderMutations`: thêm

```ts
remove: useMutation({
  mutationFn: ordersApi.deleteOrder,
  onSuccess: () => {
    invalidate();
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['debt-alert-counts'] });
  },
}),
```

(`invalidate()` sẵn có đã cover orders/payables/receipts/suppliers/products; bổ sung `dashboard` + `debt-alert-counts` vì báo cáo & badge công nợ thay đổi.)

### `OrderDetailPage.tsx`

- Nút **"🗑 Xóa đơn (Admin)"** trong `page-actions`, **chỉ hiện khi `isAdmin`**, hiện ở **mọi trạng thái**. Style đỏ cảnh báo.
- Bấm → mở **modal cảnh báo kỹ** (state `deleteOpen`):
  - Tiêu đề: `Xóa đơn hàng {orderCode}`.
  - Nội dung cảnh báo rõ hậu quả:
    - Mã đơn, trạng thái, tổng tiền.
    - Nếu `order.status === 'RECEIVED' || 'PAID'` (hoặc có `resultPayableId`): cảnh báo đậm "Đơn này đã phát sinh **công nợ {resultPayableCode}** — xóa đơn sẽ đồng thời loại bỏ công nợ và các khoản thanh toán liên quan khỏi báo cáo & thống kê."
    - Câu chốt: "Thao tác này **không hiển thị lại** trong hệ thống."
  - **Checkbox** (state `deleteAck`): "Tôi hiểu và xác nhận xóa đơn hàng này."
  - Nút đỏ **"Xác nhận xóa"** — `disabled` khi `!deleteAck || remove.isPending`.
  - Nút "Đóng".
- `onDelete`: `await remove.mutateAsync(order.id)` → đóng modal → `navigate('/orders')`. Bắt lỗi hiển thị qua `setError`.
- Reset `deleteAck=false` mỗi lần mở modal.

## Edge cases

- Gọi API trên đơn đã xóa → 404 (`findOne`/`findFirst` đã lọc `deletedAt: null`).
- Xóa đơn PENDING (chưa có receipt/payable) → chỉ đánh dấu order.
- Staff gọi thẳng `DELETE /orders/:id` → 403 (check role trong service).
- Tồn kho: receipt đã xóa bị loại khỏi `loadLedger` nên tồn kho tự điều chỉnh giảm — đúng mong muốn (đơn nhập sai bị gỡ).
- Mã chứng từ: không tái sử dụng mã của đơn/phiếu đã xóa (count vẫn tính cả đã xóa).

## Ngoài phạm vi

- Trang xem / khôi phục đơn đã xóa (không làm).
- Xóa hàng loạt.
- Xóa cứng (hard delete).
