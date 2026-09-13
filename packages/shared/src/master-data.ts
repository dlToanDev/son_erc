// Types master data dùng chung FE + BE (Phase 3).

export type EntityStatusValue = 'ACTIVE' | 'INACTIVE';

export interface Facility {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: EntityStatusValue;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxCode: string | null;
  contactPerson: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  qrCodeUrl: string | null;
  note: string | null;
  status: EntityStatusValue;
}

/** NCC kèm tổng công nợ tính runtime. */
export interface SupplierWithTotals extends Supplier {
  totalInvoiced: number; // tổng phát sinh
  totalPaid: number; // đã trả (payments ACTIVE)
  balance: number; // còn nợ
  overdueCount: number; // số hoá đơn quá hạn
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  name: string;
  unit: string;
  price: number;
  status: EntityStatusValue;
  note: string | null;
}

/** Một lần thay đổi giá của mặt hàng (danh mục hoặc khi sửa đơn). */
export interface PriceHistoryEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  source: 'CATALOG' | 'ORDER_EDIT' | string;
  changedBy: string;
  changedByName: string | null;
  createdAt: string;
}

/** User trả về API — không bao giờ chứa passwordHash. */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  status: EntityStatusValue;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SettingsData {
  warningDays: number;
  criticalWarningDays: number;
  currency: string;
  timezone: string;
}

/** Danh sách module × action chuẩn của hệ thống (ma trận phân quyền). */
export const PERMISSION_MODULES: { module: string; actions: string[] }[] = [
  { module: 'dashboard', actions: ['view'] },
  { module: 'suppliers', actions: ['view', 'edit'] },
  { module: 'products', actions: ['view', 'edit'] },
  { module: 'orders', actions: ['view', 'edit', 'approve', 'viewPrice'] },
  { module: 'receipts', actions: ['view', 'edit'] },
  { module: 'payables', actions: ['view', 'pay'] },
  { module: 'payments', actions: ['view'] },
  { module: 'inventory', actions: ['view', 'edit'] },
  { module: 'reports', actions: ['view'] },
  { module: 'audit', actions: ['view'] },
  { module: 'users', actions: ['view', 'edit'] },
  { module: 'settings', actions: ['view', 'edit'] },
];
