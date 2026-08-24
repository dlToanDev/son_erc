// Types kho Nhập–Xuất–Tồn dùng chung FE + BE (Phase 6).

export interface IssueItemData {
  id: string;
  itemName: string;
  unit: string;
  quantity: number;
}

export interface IssueData {
  id: string;
  issueCode: string;
  facilityId: string;
  facilityName: string;
  issueDate: string;
  note: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  createdBy: string;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
  items: IssueItemData[];
}

/** 1 dòng báo cáo NXT: Tồn cuối = Tồn đầu + Nhập − Xuất. */
export interface InventoryReportRow {
  key: string;
  itemName: string;
  unit: string;
  openingQty: number;
  receivedQty: number;
  issuedQty: number;
  closingQty: number;
}

export interface InventoryReportResult {
  rows: InventoryReportRow[];
  totals: Omit<InventoryReportRow, 'key' | 'itemName' | 'unit'>;
}

export interface ShortageInfo {
  key: string;
  itemName: string;
  unit: string;
  requestedQty: number;
  availableQty: number;
}

export interface CheckIssueResult {
  ok: boolean;
  shortages: ShortageInfo[];
}

/** 1 dòng thẻ kho: chuyển động + tồn luỹ kế. */
export interface StockCardEntry {
  date: string;
  code: string; // PN-... hoặc PX-...
  type: 'NHAP' | 'XUAT';
  quantity: number;
  balance: number; // tồn sau chuyển động
}

export interface StockCardResult {
  itemName: string;
  unit: string;
  openingQty: number;
  entries: StockCardEntry[];
  closingQty: number;
}
