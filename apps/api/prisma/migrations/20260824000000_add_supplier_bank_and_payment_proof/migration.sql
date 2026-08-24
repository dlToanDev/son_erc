-- Đồng bộ migration với schema.prisma: bổ sung các cột bị thiếu ở init.
-- (Sinh từ `prisma migrate diff --from-migrations --to-schema-datamodel`.)

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "proof_url" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "bank_account_name" TEXT,
ADD COLUMN     "bank_account_no" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "qr_code_url" TEXT;
