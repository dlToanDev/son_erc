# Phase 6 — Kho Nhập–Xuất–Tồn

**Mục tiêu:** Quản lý tồn kho với bất biến chặn vượt tồn.

## Backend (API)

- [x] `GET/POST /inventory/issues` — phiếu xuất kho nhiều dòng (khoá facility chống 2 phiếu đồng thời vượt tồn)
- [x] `POST /inventory/issues/:id/cancel` — huỷ phiếu xuất (soft-void, hoàn tồn)
- [x] `GET /inventory/report` — báo cáo Nhập–Xuất–Tồn theo cơ sở & khoảng ngày
- [x] `POST /inventory/check` — kiểm tra tồn trước khi xuất (FE chặn sớm)
- [x] `GET /inventory/card` — thẻ kho từng mặt hàng (chuyển động + tồn luỹ kế)

## Quy tắc nghiệp vụ

- `InventoryLedger.canIssue` **chặn xuất vượt tồn khả dụng**
- Phiếu nhập CONFIRMED = **nhập**; phiếu xuất ACTIVE = **xuất**
- Công thức báo cáo: **Tồn cuối = Tồn đầu + Nhập − Xuất** theo cơ sở & khoảng ngày

## Frontend

- [x] **Kho NXT** — báo cáo Nhập–Xuất–Tồn theo cơ sở & kỳ + tab danh sách phiếu xuất (huỷ hoàn tồn)
- [x] Thẻ kho từng mặt hàng (click dòng báo cáo → modal thẻ kho)
- [x] Lập phiếu xuất — **chặn vượt tồn** ngay trên UI (cảnh báo VƯỢT TỒN + POST /check) + server kiểm lại trong transaction

## Definition of Done

- Không thể xuất quá tồn khả dụng (chặn cả FE lẫn BE).
- Báo cáo NXT khớp số học theo cơ sở & khoảng ngày.
- Cancel phiếu xuất hoàn tồn đúng.
