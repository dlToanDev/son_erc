# Báo cáo e2e DebtFlow — trạng thái sau khi sửa (2026-08-24)

Chạy tự động qua **đường production thật**: Postgres tạm (`df-verify` :5439) → `prisma migrate deploy` → seed → 81 test e2e.

## Kết quả cuối
```
Test Suites: 8 passed, 8 total
Tests:       81 passed, 81 total
```
Tất cả suite xanh: health, auth, master-data, orders, finance, inventory, reports, audit.

## Trước đó: 47/81 fail — do 3 điểm lệch (drift), không phải lỗi logic

### Điểm 1 — Migration thiếu cột (CHẶN DEPLOY, nghiêm trọng nhất) ✅ đã sửa
- `schema.prisma` có `suppliers.bank_name/bank_account_no/bank_account_name/qr_code_url` và `payments.proof_url`, nhưng migration `init` **không có** → `migrate deploy` tạo DB thiếu cột → seed & app chết (`P2022`).
- **Sửa:** thêm migration `20260824000000_add_supplier_bank_and_payment_proof` (SQL sinh từ `prisma migrate diff`). Nay `migrate deploy` chạy sạch.

### Điểm 2 — Seed sản phẩm lệch test (12 lỗi `undefined.id`) ✅ đã sửa
- Test orders hardcode mặt hàng cũ ("Nước ngọt lon" 240k, "Gạo ST25" 720k) không còn trong seed Garden Chay.
- **Sửa:** làm `orders.e2e-spec.ts` **seed-agnostic** — lấy 2 mặt hàng đầu + giá thực tế từ danh mục, vẫn kiểm chứng đúng "giá snapshot server-side". Giữ nguyên dữ liệu demo Garden Chay có chủ đích.

### Điểm 3 — Quyền staff seed thiếu (32 lỗi 403) ✅ đã sửa
- Seed chỉ cấp staff `orders: view/edit`.
- **Sửa:** cấp đúng bộ quyền vận hành trong `seed.ts`:
  `suppliers view/edit`, `products view`, `orders view/edit`, `receipts view/edit`,
  `payables view/pay`, `payments view`, `inventory view/edit`, `audit view`, `dashboard view`.
  (KHÔNG có: products.edit, settings.edit, users.*, orders.approve, reports.view.)

## Phát sinh khi sửa (phát hiện thêm) ✅ đã sửa
- **Bug thật trong app:** `reports.service.stats()` **âm thầm** fallback `range` sai về `1m` thay vì báo lỗi, trong khi `dashboard()` thì trả 400. Đã cho `stats()` cũng ném `400` khi `range` không hợp lệ → nhất quán.
- **Tên admin seed:** đổi "Quản trị viên Admin" → "Quản trị viên" để khớp truy vết audit.

## Chạy lại báo cáo bất cứ lúc nào
```
bash apps/api/test/run-e2e-report.sh
```
Sinh `docs/test-reports/e2e-<timestamp>.md` + log thô `e2e-raw.log`. Tự dọn container sau khi chạy.
