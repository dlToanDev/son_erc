import type {
  CheckIssueResult,
  InventoryReportResult,
  IssueData,
  StockCardResult,
} from '@debtflow/shared';
import { apiGet, apiPost, apiPut } from './client';

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : '';
};

export interface IssueInput {
  facilityId: string;
  issueDate: string;
  note?: string;
  items: { itemName: string; unit: string; quantity: number }[];
}

export const listIssues = (filter?: { facilityId?: string; status?: string }) =>
  apiGet<IssueData[]>(`/inventory/issues${qs(filter ?? {})}`);
export const createIssue = (body: IssueInput) => apiPost<IssueData>('/inventory/issues', body);
export const updateIssue = (id: string, body: Partial<IssueInput>) => apiPut<IssueData>(`/inventory/issues/${id}`, body);
export const cancelIssue = (id: string) => apiPost<IssueData>(`/inventory/issues/${id}/cancel`);
export const getReport = (from: string, to: string, facilityId?: string) =>
  apiGet<InventoryReportResult>(`/inventory/report${qs({ from, to, facilityId })}`);
export const checkIssue = (body: Omit<IssueInput, 'note'>) =>
  apiPost<CheckIssueResult>('/inventory/check', body);
export const getStockCard = (params: {
  facilityId: string;
  itemName: string;
  unit: string;
  from: string;
  to: string;
}) => apiGet<StockCardResult>(`/inventory/card${qs(params)}`);
