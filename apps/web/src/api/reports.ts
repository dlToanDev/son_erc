import type { CompareData, DashboardData, DebtAlertCounts, RangeValue, StatsData } from '@debtflow/shared';
import { apiGet } from './client';

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const getDashboard = (range: RangeValue, facilityId?: string) =>
  apiGet<DashboardData>(`/reports/dashboard${qs({ range, facilityId })}`);

export const getDebtAlertCounts = () => apiGet<DebtAlertCounts>('/reports/debt-alerts');

export const getStats = (range: RangeValue, facilityId?: string, from?: string, to?: string) =>
  apiGet<StatsData>(`/reports/stats${qs({ range, facilityId, from, to })}`);

export const getCompare = (
  periods: { fromA: string; toA: string; fromB: string; toB: string },
  facilityId?: string,
) => apiGet<CompareData>(`/reports/compare${qs({ ...periods, facilityId })}`);
