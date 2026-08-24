/** Định dạng tiền VND: 12.960.000 VND */
export const formatMoney = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value) + ' VND';

/** Định dạng ngày giờ ngắn theo vi-VN. */
export const formatDateTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString('vi-VN') : '—';
