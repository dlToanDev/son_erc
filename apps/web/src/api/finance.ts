import type {
  ConfirmReceiptResult,
  PayableData,
  PayableDetail,
  PaymentData,
  ReceiptData,
} from '@debtflow/shared';
import { apiGet, apiPost } from './client';

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : '';
};

// ---- Receipts ----
export interface CreateReceiptInput {
  supplierId: string;
  facilityId: string;
  supplierInvoiceCode?: string;
  receiptDate: string;
  dueDate?: string;
  discountAmount?: number;
  taxAmount?: number;
  note?: string;
  items: { itemName: string; unit: string; quantity: number; unitPrice: number; note?: string }[];
}

export const listReceipts = (filter?: {
  supplierId?: string;
  facilityId?: string;
  status?: string;
}) => apiGet<ReceiptData[]>(`/receipts${qs(filter ?? {})}`);
export const getReceipt = (id: string) => apiGet<ReceiptData>(`/receipts/${id}`);
export const createReceipt = (body: CreateReceiptInput) => apiPost<ReceiptData>('/receipts', body);
export const confirmReceipt = (id: string) =>
  apiPost<ConfirmReceiptResult>(`/receipts/${id}/confirm`);

// ---- Payables ----
export const listPayables = (filter?: { supplierId?: string; status?: string }) =>
  apiGet<PayableData[]>(`/payables${qs(filter ?? {})}`);
export const getPayable = (id: string) => apiGet<PayableDetail>(`/payables/${id}`);

// ---- Payments ----
export interface CreatePaymentInput {
  payableId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  transactionCode?: string;
  proofUrl?: string;
  note?: string;
  nextDueDate?: string;
}

export const listPayments = (filter?: { payableId?: string; supplierId?: string }) =>
  apiGet<PaymentData[]>(`/payments${qs(filter ?? {})}`);
export const createPayment = (body: CreatePaymentInput) => apiPost<PaymentData>('/payments', body);
export const voidPayment = (id: string) => apiPost<PaymentData>(`/payments/${id}/void`);
