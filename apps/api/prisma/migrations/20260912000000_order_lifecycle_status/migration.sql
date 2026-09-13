-- Bù migration còn thiếu cho tính năng vòng đời đơn (RECEIVED/PAID + cột nhận/thanh toán).
-- Idempotent (IF NOT EXISTS) để an toàn nếu DB đã có sẵn qua db push.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAID';

ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "received_by" TEXT,
  ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paid_by" TEXT,
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
