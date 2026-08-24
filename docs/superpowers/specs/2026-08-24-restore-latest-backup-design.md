# Thiết kế: Backup 23h hằng ngày + Nút "Khôi phục bản gần nhất"

Ngày: 2026-08-24 · Trạng thái: đã duyệt

## Mục tiêu
Khi hệ thống gặp sự cố dữ liệu trong ngày, Admin bấm 1 nút trong **Cài đặt** để đưa DB
về **bản backup gần nhất** (thường là bản tự động lúc 23h tối hôm trước) rồi hoạt động tiếp.

## Phạm vi & môi trường
- Chạy trên **production (docker-compose.prod)**. Postgres + API + service `backup` cùng stack.
- Chỉ **Admin** (`settings.edit`) dùng được. Ghi **AuditLog** mỗi lần khôi phục.

## Thành phần

### 1. Backup tự động 23h (sửa `deploy/backup.sh` + compose)
- Chạy **đúng 23:00 giờ Việt Nam** mỗi ngày (service `backup` đặt `TZ=Asia/Ho_Chi_Minh`).
- Dump bằng `pg_dump --clean --if-exists | gzip` → `/backups/debtflow-YYYYMMDD-HHMMSS.sql.gz`.
  `--clean --if-exists` ⇒ file tự DROP trước khi tạo lại ⇒ khôi phục ghi đè sạch.
- Giữ `BACKUP_KEEP` (mặc định 14) bản mới nhất.
- API mount volume `backups` (read-only) tại `/backups`; biến `BACKUP_DIR=/backups`.

### 2. Backend (`BackupService` + endpoint trong SettingsController)
- `GET /api/v1/settings/latest-backup` (mọi user đăng nhập đọc để hiển thị): trả
  `{ fileName, createdAt } | null` — bản `.sql.gz` mới nhất trong `BACKUP_DIR`.
- `POST /api/v1/settings/restore-latest` (`settings.edit`): body `{ confirm: string }`.
  - `confirm` phải = `"KHOI PHUC"`, sai → 400.
  - Không có bản backup nào → 404 "Không có bản backup nào để khôi phục".
  - Có → chạy `gunzip -c <file> | psql "$DATABASE_URL"` (child_process). Lỗi → 500.
  - Ghi AuditLog `RESTORE_DATABASE` (detail = tên file + giờ). Trả `{ restoredFrom, backupTime }`.
- Tên file mã hoá thời gian; parse `YYYYMMDD-HHMMSS` để suy `createdAt`.

### 3. Docker
- `apps/api/Dockerfile` (runtime stage): `apk add --no-cache postgresql-client` (có `psql`).
- `docker-compose.prod.yml`: backup service thêm `TZ`; api service mount `backups:/backups:ro`
  + `BACKUP_DIR=/backups`.

### 4. Frontend (`SettingsPage` — mục "Vùng nguy hiểm")
- Hiển thị bản gần nhất (giờ) qua `useLatestBackup()`.
- Nút đỏ *"Khôi phục dữ liệu về bản gần nhất"* → Modal cảnh báo (mất dữ liệu tạo sau mốc đó)
  → ô nhập, phải gõ đúng `KHOI PHUC` mới bật nút → gọi `restore-latest`.
- Thành công → thông báo + **`window.location.reload()`** (dữ liệu đã đổi).

## Rủi ro (đã thống nhất)
- KHÔNG tự lưu dữ liệu hiện tại trước khi khôi phục → bấm nhầm là mất. Bù bằng gõ-chữ-xác-nhận + chỉ Admin.
- Admin tạo sau mốc backup có thể bị mất quyền sau khôi phục (admin gốc an toàn).
- Khôi phục ghi đè khi app đang chạy: kết nối Prisma nhàn rỗi không giữ khoá DDL nên `DROP/CREATE` chạy được; FE reload sau đó.

## Kiểm thử
- Unit: `BackupService.getLatest()` parse tên file, sắp xếp, trả null khi rỗng.
- Integration (local, host có psql): API + Postgres tạm đã seed, `BACKUP_DIR=./backups` chứa 1 dump thật →
  đổi dữ liệu (thêm 1 bản ghi) → `POST /settings/restore-latest {confirm:"KHOI PHUC"}` →
  xác nhận dữ liệu quay về đúng bản backup (đếm dòng khớp) + có AuditLog `RESTORE_DATABASE`.
- RBAC: staff gọi restore → 403; confirm sai → 400.
