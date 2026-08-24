// Sinh mã chứng từ theo năm: DH-2026-001, PN-2026-001, PX-2026-001.
// Dùng chung giữa orders / receipts / inventory — truyền tx khi ở trong transaction.

import { Prisma, PrismaClient } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

const pad = (n: number) => String(n).padStart(3, '0');

export async function nextOrderCode(client: Client): Promise<string> {
  const year = new Date().getFullYear();
  const count = await client.purchaseOrder.count({
    where: { orderCode: { startsWith: `DH-${year}-` } },
  });
  return `DH-${year}-${pad(count + 1)}`;
}

export async function nextReceiptCode(client: Client): Promise<string> {
  const year = new Date().getFullYear();
  const count = await client.purchaseReceipt.count({
    where: { receiptCode: { startsWith: `PN-${year}-` } },
  });
  return `PN-${year}-${pad(count + 1)}`;
}

export async function nextIssueCode(client: Client): Promise<string> {
  const year = new Date().getFullYear();
  const count = await client.inventoryIssue.count({
    where: { issueCode: { startsWith: `PX-${year}-` } },
  });
  return `PX-${year}-${pad(count + 1)}`;
}
