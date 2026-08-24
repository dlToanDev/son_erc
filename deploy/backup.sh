#!/bin/sh
# Backup DB tự động — chạy trong service `backup` (image postgres).
# Mặc định dump MỖI NGÀY LÚC 23:00 (theo TZ của container, nên đặt TZ=Asia/Ho_Chi_Minh).
# Biến môi trường:
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
#   BACKUP_AT   (giờ chạy hằng ngày, mặc định "23:00")
#   BACKUP_KEEP (số bản giữ, mặc định 14)
# Chạy 1 bản ngay rồi thoát:  sh /backup.sh once

set -e
BACKUP_AT="${BACKUP_AT:-23:00}"
KEEP="${BACKUP_KEEP:-14}"
# Đẩy backup ra cloud (offsite) — chống mất khi cả VPS chết.
# RCLONE_REMOTE ví dụ: "gdrive:debtflow-backups" (cấu hình 1 lần bằng `rclone config`).
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
RCLONE_KEEP_DAYS="${RCLONE_KEEP_DAYS:-30}"

# Đẩy toàn bộ .sql.gz lên cloud rồi dọn bản quá cũ trên cloud. Lỗi mạng KHÔNG làm hỏng backup local.
upload_offsite() {
  [ -n "$RCLONE_REMOTE" ] || return 0
  if ! command -v rclone >/dev/null 2>&1; then
    echo "[backup] CẢNH BÁO: chưa có rclone trong image — bỏ qua đẩy cloud."
    return 0
  fi
  echo "[backup] đẩy lên cloud: ${RCLONE_REMOTE}"
  if rclone copy /backups "$RCLONE_REMOTE" --include "debtflow-*.sql.gz" 2>&1; then
    # Dọn bản cũ hơn RCLONE_KEEP_DAYS ngày trên cloud (chỉ xoá bản cũ, an toàn).
    rclone delete "$RCLONE_REMOTE" --include "debtflow-*.sql.gz" --min-age "${RCLONE_KEEP_DAYS}d" 2>&1 || true
    echo "[backup] đẩy cloud xong."
  else
    echo "[backup] LỖI đẩy cloud (giữ nguyên bản local, sẽ thử lại lần sau)."
  fi
}

run_backup() {
  ts=$(date +%Y%m%d-%H%M%S)
  file="/backups/debtflow-${ts}.sql.gz"
  echo "[backup] pg_dump → ${file}"
  # --clean --if-exists: bản dump tự DROP trước khi tạo lại → khôi phục ghi đè sạch, không lỗi trùng.
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --clean --if-exists \
    -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$file"
  # Giữ KEEP bản mới nhất, xoá phần còn lại.
  ls -1t /backups/debtflow-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
  echo "[backup] xong. Hiện có: $(ls -1 /backups/debtflow-*.sql.gz 2>/dev/null | wc -l) bản (local)."
  upload_offsite
}

if [ "$1" = "once" ]; then
  run_backup
  exit 0
fi

echo "[backup] lịch chạy: mỗi ngày lúc ${BACKUP_AT} (TZ=$(date +%Z)), giữ ${KEEP} bản."
while true; do
  now=$(date +%s)
  target=$(date -d "today ${BACKUP_AT}" +%s 2>/dev/null || echo 0)
  # Đã qua giờ hôm nay (hoặc lỗi tính) → hẹn cho ngày mai.
  if [ "$target" -le "$now" ]; then
    target=$(date -d "tomorrow ${BACKUP_AT}" +%s)
  fi
  wait_s=$((target - now))
  echo "[backup] chờ ${wait_s}s tới lần chạy kế tiếp."
  sleep "$wait_s"
  run_backup || echo "[backup] LỖI — sẽ thử lại vào ${BACKUP_AT} ngày mai."
done
