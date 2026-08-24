# Phase 7 — Báo cáo · Dashboard · Thống kê · So sánh kỳ

**Mục tiêu:** Tầng phân tích & ra quyết định.

## Backend (API)

- [x] `GET /reports/dashboard` — 4 KPI + so sánh kỳ trước + series + so sánh cơ sở + cảnh báo
- [x] `GET /reports/stats` — sản lượng/chi phí theo mặt hàng, lọc cơ sở & kỳ
- [x] `GET /reports/compare` — đối chiếu chi phí nhập 2 kỳ tuỳ chọn
- [x] `GET /reports/debt-alerts` — đếm cảnh báo cho badge sidebar
- [x] Dùng `PeriodCalculator`: mốc kỳ, kỳ trước, % thay đổi (null khi kỳ trước = 0)

## Dashboard

- [x] 4 KPI + so sánh kỳ trước (chi phí nhập, đã thanh toán, số phiếu, công nợ hiện tại + quá hạn)
- [x] Chọn khoảng 1 / 3 / 6 / 12 tháng
- [x] So sánh giữa các cơ sở (thanh ngang %)
- [x] Cảnh báo dùng vượt tháng (banner khi tháng này > tháng trước)
- [x] Biểu đồ SVG thuần (bar chart theo ngày/tháng)

## Cảnh báo công nợ

- [x] Dựa `warningDays` / `criticalWarningDays` từ settings
- [x] Badge "sắp đến hạn" & "quá hạn" trên Dashboard và sidebar (link Công nợ)
- [x] Tô màu theo mức: OVERDUE đỏ · CRITICAL vàng · WARNING xanh

## Frontend

- [x] **Thống kê** — sản lượng/chi phí theo cơ sở & kỳ, **xuất CSV/Excel UTF-8 có BOM**
- [x] **So sánh kỳ** — đối chiếu chi phí nhập 2 kỳ (chọn 2 khoảng ngày tuỳ ý, % từng mặt hàng)

## Definition of Done

- KPI & biểu đồ khớp dữ liệu thực.
- Cảnh báo hiển thị đúng theo ngưỡng cấu hình.
- Xuất CSV chuẩn UTF-8 có BOM, mở đúng trên Excel.
