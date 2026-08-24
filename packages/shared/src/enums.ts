// Enum trạng thái dùng chung FE + BE — khớp với Prisma schema (Phase 1).

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ReceiptStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
}

/** Trạng thái công nợ — tính runtime từ payments & dueDate, không lưu cứng. */
export enum PayableStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

/** Payment & InventoryIssue: soft-void (không xoá cứng). */
export enum RecordStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

export enum PaymentDirection {
  OUT = 'OUT',
  IN = 'IN',
}
