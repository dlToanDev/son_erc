import { inventoryReport, canIssue } from './inventory.ledger';

describe('InventoryLedger (port từ logic.js demo)', () => {
  it('inventoryReport tính tồn đầu/nhập/xuất/tồn cuối theo cơ sở', () => {
    const result = inventoryReport({
      purchaseReceipts: [
        { facilityId: 'fac-a', receiptDate: '2026-06-30', status: 'CONFIRMED', items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 5 }] },
        { facilityId: 'fac-a', receiptDate: '2026-07-08', status: 'CONFIRMED', items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 8 }] },
        { facilityId: 'fac-a', receiptDate: '2026-07-12', status: 'DRAFT', items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 99 }] },
        { facilityId: 'fac-b', receiptDate: '2026-07-08', status: 'CONFIRMED', items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 80 }] },
      ],
      inventoryIssues: [
        { facilityId: 'fac-a', issueDate: '2026-07-10', status: 'ACTIVE', items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 3 }] },
        { facilityId: 'fac-a', issueDate: '2026-07-11', status: 'CANCELLED', items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 50 }] },
      ],
      facilityId: 'fac-a',
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(result.rows).toEqual([
      { key: 'gạo|kg', itemName: 'Gạo', unit: 'Kg', openingQty: 5, receivedQty: 8, issuedQty: 3, closingQty: 10 },
    ]);
    expect(result.totals).toEqual({ openingQty: 5, receivedQty: 8, issuedQty: 3, closingQty: 10 });
  });

  it('canIssue cho phép đúng tồn và chặn khi vượt tồn', () => {
    const source = {
      purchaseReceipts: [
        { facilityId: 'fac-a', receiptDate: '2026-07-01', status: 'CONFIRMED', items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 10 }] },
      ],
      inventoryIssues: [],
      facilityId: 'fac-a',
      issueDate: '2026-07-20',
    };

    expect(canIssue({ ...source, items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 10 }] })).toEqual({
      ok: true,
      shortages: [],
    });
    expect(canIssue({ ...source, items: [{ itemName: 'Gạo', unit: 'Kg', quantity: 10.5 }] })).toEqual({
      ok: false,
      shortages: [{ key: 'gạo|kg', itemName: 'Gạo', unit: 'Kg', requestedQty: 10.5, availableQty: 10 }],
    });
  });
});
