# Tuổi nợ (AP Aging) + Dự báo dòng tiền + Lịch sử giá NCC

**Ngày:** 2026-09-13
**Trạng thái:** Đã duyệt thiết kế

Ba tính năng quản trị, không đụng logic tiền hiện có (chỉ thêm truy vấn đọc + 1 bảng lịch sử ghi thêm khi giá đổi).

## 1 & 2 — Trang "Tuổi nợ & Dòng tiền"

Dùng chung nguồn: bảng `Payable` (chưa xóa, `balance > 0`), tính runtime như các báo cáo khác. **Không lọc theo cơ sở** (công nợ theo NCC, không theo cơ sở).

### Backend
- `reports.service.payablesAging()` → `PayablesAgingData`:
  - **Aging theo NCC:** với mỗi payable balance>0, tính `overdueDays = today − dueDate`. Bậc:
    - `current` (≤ 0 hoặc không có dueDate) = Chưa đến hạn
    - `d1_30` (1–30) · `d31_60` (31–60) · `d61_90` (61–90) · `d90plus` (>90)
    - Gom theo supplier → `AgingRow` + dòng `totals`.
  - **Cashflow (dòng tiền ra sắp tới):** gom theo `dueDate` vs hôm nay:
    - `overdue` (Quá hạn) · `week1` (0–7 ngày) · `week2` (8–14) · `month` (15–30) · `later` (>30)
    - Mỗi bậc: `{ key, label, amount, count }`.
- Endpoint: `GET /reports/payables-aging` — `@RequirePermission('reports','view')`.
- Types shared (`reports.ts`): `AgingRow`, `AgingTotals`, `CashflowBucket`, `PayablesAgingData`.

### Frontend
- Trang mới `pages/AgingPage.tsx`, route `/reports/aging`, mục sidebar **"Tuổi nợ & Dòng tiền"** (icon `CalendarClock`/`Wallet`, quyền `reports.view`), đặt sau "So sánh kỳ".
- Bố cục: (a) hàng thẻ cashflow 5 bậc; (b) bảng aging theo NCC (cột: NCC · Chưa đến hạn · 1–30 · 31–60 · 61–90 · >90 · Tổng) + dòng tổng. Responsive: laptop bảng, điện thoại thẻ (dùng `data-label` sẵn có của `data-table`).
- `hooks/queries`: `usePayablesAging()`; `api/finance.ts` hoặc `reports` api: `getPayablesAging()`.

## 3 — Lịch sử giá NCC

### Schema (migration mới)
```prisma
model SupplierProductPriceHistory {
  id                String   @id @default(cuid())
  supplierProductId String   @map("supplier_product_id")
  oldPrice          Decimal  @default(0) @map("old_price") @db.Decimal(18, 2)
  newPrice          Decimal  @default(0) @map("new_price") @db.Decimal(18, 2)
  source            String   // 'CATALOG' | 'ORDER_EDIT'
  changedBy         String   @map("changed_by")
  createdAt         DateTime @default(now()) @map("created_at")
  product SupplierProduct @relation(fields: [supplierProductId], references: [id], onDelete: Cascade)
  @@index([supplierProductId])
  @@map("supplier_product_price_history")
}
```
Thêm `priceHistory SupplierProductPriceHistory[]` vào `SupplierProduct`.

### Ghi vết (chỉ khi giá thực sự đổi)
- `suppliers.service.updateProduct`: nếu `dto.price` khác `existing.price` → tạo history `source='CATALOG'`.
- `orders.service.update` (Admin sửa giá → ghi đè danh mục, đã có sẵn): khi `it.override && oldPrice !== newPrice` → tạo history `source='ORDER_EDIT'` (trong cùng transaction).

### API + Frontend
- `GET /suppliers/:id/products/:productId/price-history` → `PriceHistoryEntry[]` (kèm tên người đổi). `@RequirePermission('products','view')`.
- Type shared (`master-data.ts`): `PriceHistoryEntry { id, oldPrice, newPrice, source, changedBy, changedByName, createdAt }`.
- `ProductsPanel`: thêm nút **"Lịch sử giá"** mỗi dòng → modal bảng (Thời gian · Giá cũ → Giá mới · Nguồn · Người đổi). Giai đoạn 1 không biểu đồ.

## Ngoài phạm vi
- Không lọc aging/cashflow theo cơ sở.
- Không xuất Excel (giai đoạn sau).
- Không biểu đồ lịch sử giá (giai đoạn sau).
