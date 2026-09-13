-- Lịch sử biến động giá mặt hàng NCC.
CREATE TABLE "supplier_product_price_history" (
    "id" TEXT NOT NULL,
    "supplier_product_id" TEXT NOT NULL,
    "old_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "new_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_product_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_product_price_history_supplier_product_id_idx" ON "supplier_product_price_history"("supplier_product_id");

ALTER TABLE "supplier_product_price_history" ADD CONSTRAINT "supplier_product_price_history_supplier_product_id_fkey" FOREIGN KEY ("supplier_product_id") REFERENCES "supplier_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
