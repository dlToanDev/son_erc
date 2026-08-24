import { invoiceBalance, invoiceStatus } from './invoice.calculator';

describe('InvoiceCalculator (port từ logic.js demo)', () => {
  it('invoiceBalance bỏ qua thanh toán đã huỷ', () => {
    const payments = [
      { amount: 200000, status: 'ACTIVE' as const },
      { amount: 100000, status: 'CANCELLED' as const },
    ];
    expect(invoiceBalance(500000, payments)).toBe(300000);
  });

  it('invoiceStatus trả PAID khi số dư = 0', () => {
    expect(
      invoiceStatus(100, [{ amount: 100, status: 'ACTIVE' }], '2026-08-10', '2026-08-05'),
    ).toBe('PAID');
  });

  it('invoiceStatus trả PARTIAL khi trả một phần & chưa tới hạn', () => {
    expect(
      invoiceStatus(100, [{ amount: 40, status: 'ACTIVE' }], '2026-08-10', '2026-08-05'),
    ).toBe('PARTIAL');
  });

  it('invoiceStatus trả OVERDUE khi còn nợ & quá hạn', () => {
    expect(invoiceStatus(100, [], '2026-08-01', '2026-08-05')).toBe('OVERDUE');
  });
});
