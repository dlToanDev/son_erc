import type { ApproveOrderResult, PurchaseOrderData } from '@debtflow/shared';
import { apiGet, apiPost, apiPut } from './client';

export interface CreateOrderInput {
  supplierId: string;
  facilityId: string;
  expectedDate?: string;
  note?: string;
  items: { productId: string; quantity: number }[];
}

export interface UpdateOrderInput {
  expectedDate?: string;
  note?: string;
  items: { productId: string; quantity: number }[];
}

export const listOrders = (filter?: { facilityId?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filter?.facilityId) params.set('facilityId', filter.facilityId);
  if (filter?.status) params.set('status', filter.status);
  const qs = params.toString();
  return apiGet<PurchaseOrderData[]>(`/orders${qs ? `?${qs}` : ''}`);
};

export const getOrder = (id: string) => apiGet<PurchaseOrderData>(`/orders/${id}`);
export const getPendingCount = () => apiGet<{ count: number }>('/orders/pending-count');
export const createOrder = (body: CreateOrderInput) => apiPost<PurchaseOrderData>('/orders', body);
export const approveOrder = (params: string | { id: string; dueDate?: string }) => {
  const id = typeof params === 'string' ? params : params.id;
  const body = typeof params === 'string' ? {} : { dueDate: params.dueDate };
  return apiPost<ApproveOrderResult>(`/orders/${id}/approve`, body);
};
export const rejectOrder = (id: string, reason: string) =>
  apiPost<PurchaseOrderData>(`/orders/${id}/reject`, { reason });
export const cancelOrder = (id: string) => apiPost<PurchaseOrderData>(`/orders/${id}/cancel`);
export const updateOrder = (id: string, body: UpdateOrderInput) =>
  apiPut<PurchaseOrderData>(`/orders/${id}`, body);
