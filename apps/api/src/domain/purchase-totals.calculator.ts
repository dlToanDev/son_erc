// PurchaseTotalsCalculator — tạm tính, giảm giá, VAT, tổng.
// Port nguyên công thức từ logic.js demo (đã kiểm thử).

export interface PurchaseItemLike {
  quantity: number;
  unitPrice: number;
}

export interface PurchaseTotals {
  lineTotals: number[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

export function purchaseTotals(
  items: PurchaseItemLike[] = [],
  discountAmount = 0,
  taxAmount = 0,
): PurchaseTotals {
  const lineTotals = items.map((item) => Number(item.quantity || 0) * Number(item.unitPrice || 0));
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  return {
    lineTotals,
    subtotal,
    discountAmount: Number(discountAmount || 0),
    taxAmount: Number(taxAmount || 0),
    grandTotal: subtotal - Number(discountAmount || 0) + Number(taxAmount || 0),
  };
}

export const PurchaseTotalsCalculator = {
  purchaseTotals,
};
