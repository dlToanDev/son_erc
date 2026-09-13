-- Xóa đơn hàng (soft-delete): thêm deleted_at/deleted_by cho đơn + phiếu nhập + công nợ.

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by" TEXT;

-- AlterTable
ALTER TABLE "purchase_receipts" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by" TEXT;

-- AlterTable
ALTER TABLE "payables" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by" TEXT;
