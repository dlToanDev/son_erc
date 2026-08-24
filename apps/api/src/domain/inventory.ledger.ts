// InventoryLedger — báo cáo Nhập–Xuất–Tồn & chặn xuất vượt tồn.
// Port nguyên công thức từ logic.js demo (đã kiểm thử).

export interface InventoryItemLike {
  itemName: string;
  unit?: string;
  quantity: number;
}

export interface ReceiptLike {
  facilityId?: string;
  receiptDate: string;
  status: string; // 'CONFIRMED' được tính vào tồn
  items?: InventoryItemLike[];
}

export interface IssueLike {
  facilityId?: string;
  issueDate: string;
  status: string; // 'ACTIVE' được tính vào tồn
  items?: InventoryItemLike[];
}

export interface InventoryRow {
  key: string;
  itemName: string;
  unit: string;
  openingQty: number;
  receivedQty: number;
  issuedQty: number;
  closingQty: number;
}

export interface InventoryTotals {
  openingQty: number;
  receivedQty: number;
  issuedQty: number;
  closingQty: number;
}

export function inventoryKey(itemName: string, unit?: string): string {
  return `${String(itemName || '')
    .trim()
    .toLocaleLowerCase('vi-VN')}|${String(unit || '')
    .trim()
    .toLocaleLowerCase('vi-VN')}`;
}

export interface InventoryReportInput {
  purchaseReceipts?: ReceiptLike[];
  inventoryIssues?: IssueLike[];
  facilityId?: string;
  from: string;
  to: string;
}

export function inventoryReport({
  purchaseReceipts = [],
  inventoryIssues = [],
  facilityId = '',
  from,
  to,
}: InventoryReportInput): { rows: InventoryRow[]; totals: InventoryTotals } {
  const rows = new Map<string, InventoryRow>();

  const add = (item: InventoryItemLike, date: string, sign: number) => {
    if (!item?.itemName || !date) return;
    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const key = inventoryKey(item.itemName, item.unit);
    const row: InventoryRow = rows.get(key) || {
      key,
      itemName: item.itemName,
      unit: item.unit || '',
      openingQty: 0,
      receivedQty: 0,
      issuedQty: 0,
      closingQty: 0,
    };
    const day = String(date).slice(0, 10);
    if (day < from) {
      row.openingQty += sign * quantity;
    } else if (day <= to) {
      if (sign > 0) row.receivedQty += quantity;
      else row.issuedQty += quantity;
    }
    rows.set(key, row);
  };

  purchaseReceipts
    .filter((r) => r.status === 'CONFIRMED' && (!facilityId || r.facilityId === facilityId))
    .forEach((r) => (r.items || []).forEach((item) => add(item, r.receiptDate, 1)));

  inventoryIssues
    .filter((r) => r.status === 'ACTIVE' && (!facilityId || r.facilityId === facilityId))
    .forEach((r) => (r.items || []).forEach((item) => add(item, r.issueDate, -1)));

  const list = [...rows.values()]
    .map((row) => ({ ...row, closingQty: row.openingQty + row.receivedQty - row.issuedQty }))
    .filter((row) => row.openingQty || row.receivedQty || row.issuedQty)
    .sort(
      (a, b) =>
        a.itemName.localeCompare(b.itemName, 'vi') || a.unit.localeCompare(b.unit, 'vi'),
    );

  const totals = list.reduce<InventoryTotals>(
    (sum, row) => ({
      openingQty: sum.openingQty + row.openingQty,
      receivedQty: sum.receivedQty + row.receivedQty,
      issuedQty: sum.issuedQty + row.issuedQty,
      closingQty: sum.closingQty + row.closingQty,
    }),
    { openingQty: 0, receivedQty: 0, issuedQty: 0, closingQty: 0 },
  );

  return { rows: list, totals };
}

export interface CanIssueInput {
  purchaseReceipts?: ReceiptLike[];
  inventoryIssues?: IssueLike[];
  facilityId?: string;
  issueDate: string;
  items?: InventoryItemLike[];
}

export interface Shortage {
  key: string;
  itemName: string;
  unit: string;
  requestedQty: number;
  availableQty: number;
}

/** Kiểm tra có thể xuất kho không — chặn vượt tồn khả dụng (dung sai 1e-9). */
export function canIssue({
  purchaseReceipts = [],
  inventoryIssues = [],
  facilityId,
  issueDate,
  items = [],
}: CanIssueInput): { ok: boolean; shortages: Shortage[] } {
  const available = new Map<string, number>(
    inventoryReport({
      purchaseReceipts,
      inventoryIssues,
      facilityId,
      from: '0000-01-01',
      to: issueDate,
    }).rows.map((row) => [row.key, row.closingQty]),
  );

  const requests = new Map<string, Omit<Shortage, 'availableQty'>>();
  items.forEach((item) => {
    const quantity = Number(item?.quantity || 0);
    if (!item?.itemName || !Number.isFinite(quantity) || quantity <= 0) return;
    const key = inventoryKey(item.itemName, item.unit);
    const request = requests.get(key) || {
      key,
      itemName: item.itemName,
      unit: item.unit || '',
      requestedQty: 0,
    };
    request.requestedQty += quantity;
    requests.set(key, request);
  });

  const shortages: Shortage[] = [...requests.values()]
    .filter((request) => request.requestedQty > (available.get(request.key) || 0) + 1e-9)
    .map((request) => ({ ...request, availableQty: available.get(request.key) || 0 }));

  return { ok: shortages.length === 0, shortages };
}

export const InventoryLedger = {
  inventoryKey,
  inventoryReport,
  canIssue,
};
