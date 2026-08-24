import { periodBounds, previousPeriodBounds, percentChange } from './period.calculator';

describe('PeriodCalculator (port từ logic.js demo)', () => {
  it('periodBounds trả cửa sổ 6 tháng bao gồm tháng chọn', () => {
    expect(periodBounds('6m', '2026-08-05')).toEqual({
      from: '2026-03-01',
      to: '2026-08-31',
      groupBy: 'month',
    });
  });

  it('periodBounds nhóm theo ngày khi 1 tháng', () => {
    expect(periodBounds('1m', '2026-08-05')).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
      groupBy: 'day',
    });
  });

  it('previousPeriodBounds trả kỳ liền trước cùng số ngày', () => {
    expect(previousPeriodBounds('2026-05-01', '2026-07-31')).toEqual({
      from: '2026-01-29',
      to: '2026-04-30',
    });
  });

  it('percentChange trả null khi kỳ trước = 0', () => {
    expect(percentChange(100, 0)).toBeNull();
  });

  it('percentChange trả % chênh lệch', () => {
    expect(percentChange(900, 800)).toBe(12.5);
  });
});
