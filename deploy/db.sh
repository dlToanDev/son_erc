#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# DebtFlow — Backup / Restore DB thủ công (dùng cho container Postgres đang chạy).
#
#   bash deploy/db.sh backup            # tạo 1 bản backup ngay → ./backups/
#   bash deploy/db.sh list              # liệt kê các bản đã có
#   bash deploy/db.sh restore <file>    # phục hồi DB từ 1 bản (GHI ĐÈ dữ liệu hiện tại)
#   bash deploy/db.sh verify <file>     # kiểm tra bản backup có phục hồi được không
#                                       # (nạp vào 1 DB tạm rồi đếm dòng — KHÔNG đụng DB thật)
#
# Cấu hình qua env (mặc định khớp docker-compose dev):
#   DB_CONTAINER=erc-son-postgres-1  DB_USER=debtflow  DB_NAME=debtflow  DB_PASS=debtflow_dev_pw
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
DB_CONTAINER="${DB_CONTAINER:-erc-son-postgres-1}"
DB_USER="${DB_USER:-debtflow}"
DB_NAME="${DB_NAME:-debtflow}"
DB_PASS="${DB_PASS:-debtflow_dev_pw}"

mkdir -p "$BACKUP_DIR"

die() { echo "❌ $*" >&2; exit 1; }
check_container() {
  docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" \
    || die "Không thấy container '$DB_CONTAINER' đang chạy. Đặt DB_CONTAINER=... nếu tên khác."
}

cmd_backup() {
  check_container
  ts=$(date +%Y%m%d-%H%M%S)
  file="$BACKUP_DIR/debtflow-${ts}.sql.gz"
  echo "▶ pg_dump $DB_NAME @ $DB_CONTAINER → $file"
  # --clean --if-exists: bản dump tự DROP trước khi tạo → phục hồi ghi đè sạch, không lỗi trùng.
  docker exec -e PGPASSWORD="$DB_PASS" "$DB_CONTAINER" \
    pg_dump --clean --if-exists -U "$DB_USER" -d "$DB_NAME" | gzip > "$file"
  [ -s "$file" ] || die "Bản dump rỗng — kiểm tra lại."
  echo "✅ Xong: $file ($(du -h "$file" | cut -f1))"
}

cmd_list() {
  echo "Các bản backup trong $BACKUP_DIR:"
  ls -1t "$BACKUP_DIR"/debtflow-*.sql.gz 2>/dev/null | while read -r f; do
    printf "  %-45s %s\n" "$(basename "$f")" "$(du -h "$f" | cut -f1)"
  done || echo "  (chưa có)"
}

cmd_restore() {
  file="${1:-}"; [ -n "$file" ] || die "Thiếu file. Dùng: db.sh restore <file>"
  [ -f "$file" ] || file="$BACKUP_DIR/$file"
  [ -f "$file" ] || die "Không thấy file backup: $1"
  check_container
  echo "⚠️  SẼ GHI ĐÈ toàn bộ DB '$DB_NAME' bằng: $(basename "$file")"
  printf "   Gõ 'yes' để tiếp tục: "; read -r ans
  [ "$ans" = "yes" ] || die "Đã huỷ."
  echo "▶ Đang phục hồi..."
  gunzip -c "$file" | docker exec -i -e PGPASSWORD="$DB_PASS" "$DB_CONTAINER" \
    psql -v ON_ERROR_STOP=0 -U "$DB_USER" -d "$DB_NAME" >/tmp/df-restore.log 2>&1
  echo "✅ Phục hồi xong. (log: /tmp/df-restore.log)"
}

# Nạp bản backup vào 1 DB tạm để chứng minh phục hồi được — KHÔNG đụng DB thật.
cmd_verify() {
  file="${1:-}"; [ -n "$file" ] || die "Thiếu file. Dùng: db.sh verify <file>"
  [ -f "$file" ] || file="$BACKUP_DIR/$file"
  [ -f "$file" ] || die "Không thấy file backup: $1"
  echo "▶ Dựng Postgres tạm (df-restore-check :5449) để thử phục hồi..."
  docker rm -f df-restore-check >/dev/null 2>&1
  docker run -d --name df-restore-check -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB_NAME" -p 5449:5432 postgres:16 >/dev/null
  for i in $(seq 1 30); do docker exec df-restore-check pg_isready -U "$DB_USER" >/dev/null 2>&1 && break; sleep 1; done
  gunzip -c "$file" | docker exec -i -e PGPASSWORD="$DB_PASS" df-restore-check \
    psql -q -U "$DB_USER" -d "$DB_NAME" >/tmp/df-verify-restore.log 2>&1
  echo "▶ Số dòng sau khi phục hồi vào DB tạm:"
  docker exec -e PGPASSWORD="$DB_PASS" df-restore-check psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT 'users='||(SELECT count(*) FROM users)||' suppliers='||(SELECT count(*) FROM suppliers)||' payables='||(SELECT count(*) FROM payables)||' payments='||(SELECT count(*) FROM payments);" 2>/dev/null
  docker rm -f df-restore-check >/dev/null 2>&1
  echo "✅ Bản backup PHỤC HỒI ĐƯỢC."
}

case "${1:-}" in
  backup)  cmd_backup ;;
  list)    cmd_list ;;
  restore) cmd_restore "${2:-}" ;;
  verify)  cmd_verify "${2:-}" ;;
  *) echo "Dùng: bash deploy/db.sh {backup|list|restore <file>|verify <file>}"; exit 1 ;;
esac
