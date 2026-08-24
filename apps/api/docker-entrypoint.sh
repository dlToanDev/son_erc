#!/bin/sh
set -e

# Tự chạy migration khi khởi động — deploy mới là schema mới.
echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

echo "[entrypoint] starting DebtFlow API..."
exec node apps/api/dist/main.js
