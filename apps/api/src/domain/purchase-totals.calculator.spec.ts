import { purchaseTotals } from './purchase-totals.calculator';

describe('PurchaseTotalsCalculator (port từ logic.js demo)', () => {
  it('tính line total với số lượng thập phân + tổng cuối', () => {
    const totals = purchaseTotals(
      [
        { quantity: 10, unitPrice: 250000 },
        { quantity: 20.5, unitPrice: 220000 },
      ],
      100000,
      50000,
    );
    expect(totals.lineTotals).toEqual([2500000, 4510000]);
    expect(totals.subtotal).toBe(7010000);
    expect(totals.grandTotal).toBe(6960000);
  });
});
