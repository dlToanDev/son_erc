// Types đặt hàng dùng chung FE + BE (Phase 4).

export type OrderStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

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
  rejectReason: string | null;
  resultReceiptId: string | null;
  resultReceiptCode?: string | null;
  resultPayableId: string | null;
  resultPayableCode?: string | null;
  createdAt: string;
  items: OrderItemData[];
  total: number; // sum(quantity × unitPrice)
}

/** Kết quả duyệt đơn — trả trọn bộ từ 1 transaction. */
export interface ApproveOrderResult {
  order: PurchaseOrderData;
  receipt: { id: string; receiptCode: string; status: string; totalAmount: number };
  payable: { id: string; invoiceCode: string; totalAmount: number; dueDate: string | null };
}
