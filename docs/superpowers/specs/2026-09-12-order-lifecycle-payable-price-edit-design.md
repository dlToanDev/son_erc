# Thiết kế: Vòng đời đơn 3 trạng thái + Công nợ theo nhận hàng + Sửa đơn giá

Ngày: 2026-09-12
Trạng thái: Đã duyệt (chờ review spec)

## Bối cảnh & vấn đề

Luồng hiện tại: khi Admin **duyệt đơn** (PENDING → APPROVED), hệ thống lập tức sinh
**Phiếu nhập (CONFIRMED) + Công nợ (Payable)** trong 1 transaction. Nghĩa là duyệt xong
là vào công nợ ngay — không phản ánh được thực tế "đã đặt nhưng chưa nhận hàng" và
"đã nhận nhưng chưa trả tiền". Ngoài ra, đơn giá luôn snapshot cứng từ danh mục NCC,
Admin không sửa được khi NCC báo tăng giá lúc giao hàng.

## Mục tiêu

1. Đơn có vòng đời 3 mốc rõ ràng: **Đã duyệt → Đã nhận hàng → Đã thanh toán**.
2. Công nợ chỉ phát sinh khi **Đã nhận hàng**; **Đã thanh toán** (trả trọn cả đơn) thì
   đơn rời khỏi công nợ.
3. Admin sửa được **đơn giá từng mặt hàng**; giá mới ghi vào đơn hiện tại + danh mục NCC.

## Ngoài phạm vi (YAGNI)

- Không hỗ trợ trả tiền từng phần (partial payment) cho một đơn — mỗi đơn **trả trọn một lần**.
- Không migrate/chỉnh dữ liệu cũ. Đơn cũ (APPROVED đã có công nợ) **giữ nguyên**; công nợ
  cũ vẫn là nợ với số tiền như hiện tại. Luồng mới chỉ áp cho đơn tạo từ khi triển khai.
- Không đổi cơ chế phân quyền tổng thể; chỉ gán quyền cho action mới.

---

## Phần 1 — Vòng đời đơn & trạng thái

Chuỗi trạng thái:

```
Chờ duyệt (PENDING) → Đã duyệt (APPROVED) → Đã nhận hàng (RECEIVED) → Đã thanh toán (PAID)
                    ↘ Từ chối (REJECTED) / Đã huỷ (CANCELLED)   [chỉ chuyển từ PENDING]
```

### Thay đổi dữ liệu (Prisma)

- `enum OrderStatus` thêm `RECEIVED`, `PAID`.
- `model PurchaseOrder` thêm các cột lưu vết (đều optional):
  - `receivedAt DateTime?`, `receivedBy String?`
  - `paidAt DateTime?`, `paidBy String?`
- `enum OrderStatusValue` (packages/shared/src/orders.ts) thêm `'RECEIVED' | 'PAID'`.
- `PurchaseOrderData` thêm `receivedAt`, `paidAt` (ISO string | null).

### Chuyển trạng thái (orders.service.ts)

- **`approve(id, dueDate?)`** — sửa lại: PENDING → APPROVED. **Bỏ** phần sinh Receipt +
  Payable. Chỉ set `status`, `reviewedBy`, `reviewedAt`. `dueDate` không dùng ở bước này nữa
  (chuyển sang bước nhận hàng). `ApproveOrderResult` trở thành chỉ trả về `order`.
- **`receive(id, receiverId, dueDate?)`** — MỚI: APPROVED → RECEIVED, trong 1 transaction:
  - Khoá dòng `FOR UPDATE`, kiểm `status === 'APPROVED'`.
  - Sinh `PurchaseReceipt` (CONFIRMED) từ items của đơn (đơn giá lấy từ `OrderItem.unitPrice`
    hiện tại — đã có thể được Admin sửa trước đó).
  - Sinh `Payable` (invoiceCode = receiptCode, totalAmount = tổng đơn, dueDate mặc định
    +30 ngày hoặc `dueDate` truyền vào).
  - Set order `status=RECEIVED`, `receivedBy`, `receivedAt`, `resultReceiptId`, `resultPayableId`.
  - Ghi audit `RECEIVE_ORDER`.
- **`pay(id, payerId, paymentInput?)`** — MỚI: RECEIVED → PAID, trong 1 transaction:
  - Khoá dòng, kiểm `status === 'RECEIVED'`, phải có `resultPayableId`.
  - Tính số dư còn lại của payable; tạo **1 `Payment`** (direction PAYABLE, amount = số dư,
    paymentDate = now, `paymentMethod`/`note` tuỳ chọn, createdBy = payerId).
  - Set order `status=PAID`, `paidBy`, `paidAt`.
  - Ghi audit `PAY_ORDER`.
- **`reject` / `cancel`** — giữ nguyên (chỉ từ PENDING; Admin vẫn được huỷ đơn đã duyệt
  theo logic hiện có, nhưng cân nhắc: nếu đơn đã RECEIVED thì đã có công nợ → không cho huỷ,
  giữ ràng buộc hiện tại là chỉ Admin huỷ được APPROVED, không đụng RECEIVED/PAID).

### Controller & DTO

- `POST /orders/:id/receive` → `RequirePermission('orders','approve')`, body `ReceiveOrderDto { dueDate? }`.
- `POST /orders/:id/pay` → `RequirePermission('orders','approve')`, body `PayOrderDto { paymentMethod?, note? }`.
- `approve` giữ endpoint, bỏ tạo công nợ.

---

## Phần 2 — Công nợ (Payable)

- Payable chỉ tồn tại từ khi đơn **Đã nhận hàng** → danh sách công nợ tự nhiên = đơn đã nhận hàng.
- Đơn **Đã thanh toán** = payable có số dư 0 (status runtime PAID) → không còn tính vào nợ.
- **Tổng nợ theo NCC** = tổng số dư (`balance`) các payable **chưa trả hết** của NCC đó.
- `PayablesService` **không đổi**: vẫn trả toàn bộ payable + tính `balance`/`status` runtime.
  Trang `PayablesPage` đã tự lọc client-side (còn nợ / đã trả / quá hạn…) và cần cả payable
  đã trả cho thẻ "Đã thanh toán", nên giữ nguyên là hợp lý.
- Không thay đổi công thức `invoiceBalance` / `invoiceStatus`.

## Phần 3 — Sửa đơn giá (chỉ Admin)

- `UpdateOrderDto.items[]` thêm field `unitPrice?: number` (optional).
- Trong `OrdersService.update`:
  - Cho phép sửa ở trạng thái **PENDING, APPROVED, RECEIVED**. Chặn ở **PAID, REJECTED, CANCELLED**
    (thêm PAID vào danh sách chặn hiện có).
  - Với mỗi dòng: nếu `unitPrice` được truyền **và người dùng là ADMIN** → dùng giá đó cho
    `OrderItem.unitPrice`, đồng thời **ghi đè `SupplierProduct.price`** trong danh mục NCC.
    Nếu không truyền `unitPrice` (hoặc không phải Admin) → giữ hành vi cũ: snapshot từ danh mục.
  - Nếu đơn đã **RECEIVED** (có `resultReceiptId`/`resultPayableId`): resync lại
    **ReceiptItem** + `Payable.totalAmount` của **đơn này** theo giá mới.
  - Công nợ của **đơn khác** không bị ảnh hưởng (mỗi đơn là payable riêng).
- Ghi audit `UPDATE_ORDER` (đã có), nêu rõ có đổi giá.

## Phần 4 — Frontend (apps/web)

- `OrderStatusBadge`: thêm `RECEIVED` ("Đã nhận hàng"), `PAID` ("Đã thanh toán") + màu badge.
- `src/api/orders.ts`: thêm `receiveOrder(id, dueDate?)`, `payOrder(id, body?)`; `updateOrder`
  gửi thêm `unitPrice` mỗi dòng.
- `OrderDetailPage` / `OrdersPage`:
  - Nút **"Đã nhận hàng"** hiện khi đơn APPROVED; nút **"Đã thanh toán"** hiện khi RECEIVED.
  - Ô nhập đơn giá sửa được cho **Admin** khi đơn ở PENDING/APPROVED/RECEIVED; STAFF chỉ xem.
  - Cập nhật tab/bộ lọc trạng thái để có RECEIVED, PAID.
- Trang công nợ (`PayablesPage`): mặc định hiển thị "còn nợ"; hiển thị tổng nợ theo NCC.
- Cập nhật `queries.ts` (React Query) invalidation cho các mutation mới.

## Phần 5 — Dữ liệu hiện có

Không migration dữ liệu. Đơn cũ giữ nguyên trạng thái (APPROVED cũ vẫn có sẵn công nợ theo
luồng cũ); công nợ cũ giữ nguyên số tiền và vẫn hiển thị bình thường ở trang Công nợ.

**Lưu ý triển khai DB:** schema được đồng bộ bằng `prisma db push` (khớp với tình trạng
drift sẵn có của DB dev — các cột bank/proof cũng từng được push). Chưa tạo file migration.
Khi deploy production bằng `prisma migrate deploy` cần sinh 1 migration bổ sung enum
`RECEIVED`/`PAID` + 4 cột `received_by/at`, `paid_by/at`.

---

## Kiểm thử

- **Vòng đời**: tạo → duyệt (không sinh payable) → nhận hàng (sinh receipt + payable, vào công nợ)
  → thanh toán (payable balance 0, rời công nợ). Kiểm mỗi bước chặn sai trạng thái.
- **Công nợ theo NCC**: 1 NCC nhiều đơn, trả một số đơn → tổng nợ = tổng đơn chưa trả.
- **Sửa giá (Admin)**: sửa giá ở PENDING/APPROVED → giá + danh mục NCC cập nhật; sửa giá ở
  RECEIVED → receipt + payable cập nhật; công nợ cũ đơn khác không đổi; đơn PAID bị chặn sửa.
- **Phân quyền**: STAFF không sửa được giá, không nhận hàng/thanh toán.
- **Dữ liệu cũ**: công nợ cũ vẫn hiển thị, số tiền không đổi.

## Rủi ro / lưu ý

- `ApproveOrderResult` đổi shape (bỏ receipt/payable) → cập nhật mọi nơi FE dùng kết quả duyệt.
- Cần regenerate Prisma client + tạo migration cho enum & cột mới.
- `packages/shared` phải build lại để FE/BE dùng type mới.
