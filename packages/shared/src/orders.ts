// Types đặt hàng dùng chung FE + BE (Phase 4).

export type OrderStatusValue =
  | 'PENDING'
  | 'APPROVED'
  | 'RECEIVED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED';

export interface OrderItemData {
  id: string;
  productId: string | null;
  name: string;
  unit: string;
  unitPrice: number; // snapshot lúc tạo
  quantity: number;
}

export interface PurchaseOrderData {
  id: string;
  orderCode: string;
  supplierId: string;
  supplierName: string;
  facilityId: string;
  facilityName: string;
  status: OrderStatusValue;
  note: string | null;
  expectedDate: string | null;
  createdBy: string;
  createdByName: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  receivedAt: string | null;
  paidAt: string | null;
  rejectReason: string | null;
  resultReceiptId: string | null;
  resultReceiptCode?: string | null;
  resultPayableId: string | null;
  resultPayableCode?: string | null;
  createdAt: string;
  items: OrderItemData[];
  total: number; // sum(quantity × unitPrice)
}

/**
 * Kết quả NHẬN HÀNG — sinh phiếu nhập + công nợ trong 1 transaction.
 * (Duyệt đơn không còn sinh công nợ; xem OrdersService.receive.)
 */
export interface ReceiveOrderResult {
  order: PurchaseOrderData;
  receipt: { id: string; receiptCode: string; status: string; totalAmount: number };
  payable: { id: string; invoiceCode: string; totalAmount: number; dueDate: string | null };
}
