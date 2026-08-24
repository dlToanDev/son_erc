#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# DebtFlow — Tự động chạy e2e và ghi báo cáo Markdown.
# Dựng Postgres tạm -> đồng bộ schema -> seed -> chạy 81 test -> sinh report.
#
# Dùng:  bash apps/api/test/run-e2e-report.sh
# Kết quả: docs/test-reports/e2e-<timestamp>.md  (+ e2e-raw.log)
# ---------------------------------------------------------------------------
set -uo pipefail

API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$API_DIR/../.." && pwd)"
REPORT_DIR="$ROOT_DIR/docs/test-reports"
STAMP="$(date +%Y%m%d-%H%M%S)"
RAW_LOG="$REPORT_DIR/e2e-raw.log"
REPORT="$REPORT_DIR/e2e-$STAMP.md"
CONTAINER="df-verify"
PORT=5439
export DATABASE_URL="postgresql://debtflow:debtflow@localhost:$PORT/debtflow?schema=public"
export JWT_ACCESS_SECRET=test_access JWT_REFRESH_SECRET=test_refresh
export JWT_ACCESS_TTL=15m JWT_REFRESH_TTL=7d

mkdir -p "$REPORT_DIR"
cd "$API_DIR"

echo "▶ Dựng Postgres tạm ($CONTAINER :$PORT)..."
docker rm -f "$CONTAINER" >/dev/null 2>&1
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER=debtflow -e POSTGRES_PASSWORD=debtflow -e POSTGRES_DB=debtflow \
  -p $PORT:5432 postgres:16 >/dev/null
for i in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U debtflow >/dev/null 2>&1 && break
  sleep 1
done

echo "▶ prisma generate + migrate deploy (đúng đường production) + seed..."
npx prisma generate >/dev/null 2>&1
npx prisma migrate deploy 2>&1 | tail -3
SEED_ADMIN_EMAIL=admin@debtflow.local SEED_ADMIN_PASSWORD=admin123 \
  npx prisma db seed >/dev/null 2>&1

echo "▶ Chạy e2e (jest --runInBand)..."
npx jest --config test/jest-e2e.config.js --runInBand --verbose > "$RAW_LOG" 2>&1
JEST_EXIT=$?

SUMMARY="$(grep -E 'Tests:|Test Suites:|Time:' "$RAW_LOG")"
SUITES="$(grep -E '^(PASS|FAIL)' "$RAW_LOG")"

echo "▶ Ghi báo cáo: $REPORT"
{
  echo "# Báo cáo e2e DebtFlow — $STAMP"
  echo ""
  echo "- Kết quả jest exit code: \`$JEST_EXIT\` ($([ $JEST_EXIT -eq 0 ] && echo 'PASS' || echo 'CÓ LỖI'))"
  echo "- DB: Postgres tạm \`$CONTAINER\` cổng $PORT (đồng bộ bằng \`db push\` + seed)"
  echo ""
  echo "## Tổng quan"
  echo '```'
  echo "$SUMMARY"
  echo '```'
  echo ""
  echo "## Trạng thái từng suite"
  echo '```'
  echo "$SUITES"
  echo '```'
  echo ""
  echo "## Danh sách test (✓ pass / ✗ fail)"
  echo '```'
  grep -E '^\s+(✓|✗|√|×)' "$RAW_LOG" || echo "(xem e2e-raw.log)"
  echo '```'
  echo ""
  echo "## Các lỗi (đầu mục)"
  echo '```'
  grep -E '●' "$RAW_LOG" | head -60
  echo '```'
  echo ""
  echo "_Log đầy đủ: docs/test-reports/e2e-raw.log_"
} > "$REPORT"

echo "▶ Dọn container..."
docker rm -f "$CONTAINER" >/dev/null 2>&1

echo ""
echo "✅ Xong. Báo cáo: $REPORT"
echo "$SUMMARY"
exit $JEST_EXIT
