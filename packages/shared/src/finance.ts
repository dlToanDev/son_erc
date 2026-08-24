// Types tài chính dùng chung FE + BE (Phase 5).

export type ReceiptStatusValue = 'DRAFT' | 'CONFIRMED';
export type PaymentStatusValue = 'ACTIVE' | 'CANCELLED';
export type PayableStatusRuntime = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface ReceiptItemData {
  id: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
}

export interface ReceiptData {
  id: string;
  receiptCode: string;
  supplierId: string;
  supplierName: string;
  facilityId: string;
  facilityName: string;
  supplierInvoiceCode: string | null;
  receiptDate: string;
  dueDate: string | null;
  status: ReceiptStatusValue;
  discountAmount: number;
  taxAmount: number;
  note: string | null;
  createdBy: string;
  confirmedBy: string | null;
  createdAt: string;
  items: ReceiptItemData[];
  subtotal: number;
  grandTotal: number; // subtotal − giảm giá + VAT
  payableId: string | null;
}

export interface PaymentData {
  id: string;
  payableId: string;
  invoiceCode: string;
  supplierName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  transactionCode: string | null;
  proofUrl: string | null;
  note: string | null;
  status: PaymentStatusValue;
  createdBy: string;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
}

export interface PayableData {
  id: string;
  invoiceCode: string;
  supplierId: string;
  supplierName: string;
  purchaseReceiptId: string | null;
  receiptCode: string | null;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  paid: number; // tổng payments ACTIVE
  balance: number; // còn lại — runtime
  status: PayableStatusRuntime; // runtime, KHÔNG lưu cứng
  description: string | null;
  note: string | null;
  createdAt: string;
  items?: ReceiptItemData[];
}

export interface PayableDetail extends PayableData {
  payments: PaymentData[];
}

/** Kết quả xác nhận phiếu nhập — receipt + payable sinh trong 1 transaction. */
export interface ConfirmReceiptResult {
  receipt: ReceiptData;
  payable: PayableData;
}
