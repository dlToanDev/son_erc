import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CheckIssueResult,
  InventoryReportResult,
  IssueData,
  StockCardResult,
} from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { canIssue, inventoryKey, inventoryReport } from '../domain';
import type { IssueLike, ReceiptLike } from '../domain';
import { nextIssueCode } from '../common/codes';
import { CheckIssueDto, CreateIssueDto, UpdateIssueDto } from './dto/inventory.dto';

const ISSUE_INCLUDE = {
  items: true,
  facility: { select: { name: true } },
} satisfies Prisma.InventoryIssueInclude;

type IssueRow = Prisma.InventoryIssueGetPayload<{ include: typeof ISSUE_INCLUDE }>;
type LedgerClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Issues ----

  async findIssues(filter: { facilityId?: string; status?: string }): Promise<IssueData[]> {
    const issues = await this.prisma.inventoryIssue.findMany({
      where: {
        facilityId: filter.facilityId || undefined,
        status: (filter.status as 'ACTIVE' | 'CANCELLED') || undefined,
      },
      include: ISSUE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return issues.map((i) => this.serialize(i));
  }

  /**
   * Lập phiếu xuất — 1 TRANSACTION: khoá facility (mutex chống 2 phiếu
   * đồng thời vượt tồn) → canIssue chặn xuất vượt tồn khả dụng → tạo + audit.
   */
  async createIssue(dto: CreateIssueDto, userId: string): Promise<IssueData> {
    const facility = await this.prisma.facility.findUnique({
      where: { id: dto.facilityId },
      select: { status: true },
    });
    if (!facility || facility.status !== 'ACTIVE') {
      throw new BadRequestException('Cơ sở không hợp lệ hoặc đã ẩn');
    }

    const issue = await this.prisma.$transaction(async (tx) => {
      // Mutex theo cơ sở: mọi phiếu xuất của cùng facility phải xếp hàng.
      await tx.$queryRaw`SELECT id FROM facilities WHERE id = ${dto.facilityId} FOR UPDATE`;

      const { receipts, issues } = await this.loadLedger(tx, dto.facilityId);
      const check = canIssue({
        purchaseReceipts: receipts,
        inventoryIssues: issues,
        facilityId: dto.facilityId,
        issueDate: dto.issueDate,
        items: dto.items,
      });
      if (!check.ok) {
        const detail = check.shortages
          .map((s) => `${s.itemName} (${s.unit}): cần ${s.requestedQty}, khả dụng ${s.availableQty}`)
          .join('; ');
        throw new BadRequestException(`Xuất vượt tồn khả dụng — ${detail}`);
      }

      const issueCode = await nextIssueCode(tx);
      const created = await tx.inventoryIssue.create({
        data: {
          issueCode,
          facilityId: dto.facilityId,
          issueDate: new Date(dto.issueDate),
          note: dto.note,
          createdBy: userId,
          items: { create: dto.items },
        },
        include: ISSUE_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_ISSUE',
          entityType: 'ISSUE',
          entityId: created.id,
          detail: `Lập phiếu xuất ${issueCode} (${dto.items.length} dòng)`,
        },
      });
      return created;
    });

    return this.serialize(issue);
  }

  /** Huỷ phiếu xuất — soft-void ACTIVE → CANCELLED ⇒ tồn tự hoàn (report chỉ đếm ACTIVE). */
  async cancelIssue(id: string, userId: string): Promise<IssueData> {
    const issue = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory_issues WHERE id = ${id} FOR UPDATE`;

      const existing = await tx.inventoryIssue.findUnique({ where: { id }, select: { status: true, issueCode: true } });
      if (!existing) throw new NotFoundException('Không tìm thấy phiếu xuất');
      if (existing.status !== 'ACTIVE') {
        throw new ConflictException('Phiếu xuất đã bị huỷ trước đó');
      }

      const updated = await tx.inventoryIssue.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledBy: userId, cancelledAt: new Date() },
        include: ISSUE_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CANCEL_ISSUE',
          entityType: 'ISSUE',
          entityId: id,
          detail: `Huỷ phiếu xuất ${existing.issueCode} — hoàn tồn`,
        },
      });
      return updated;
    });

    return this.serialize(issue);
  }

  /** Cập nhật phiếu xuất kho (ghi chú, ngày xuất hoặc items xuất) */
  async updateIssue(id: string, dto: UpdateIssueDto, userId: string): Promise<IssueData> {
    const issue = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory_issues WHERE id = ${id} FOR UPDATE`;

      const existing = await tx.inventoryIssue.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) throw new NotFoundException('Không tìm thấy phiếu xuất');
      if (existing.status !== 'ACTIVE') {
        throw new ConflictException('Phiếu xuất đã bị huỷ, không thể chỉnh sửa');
      }

      if (dto.items && dto.items.length > 0) {
        await tx.issueItem.deleteMany({ where: { issueId: id } });
        await tx.issueItem.createMany({
          data: dto.items.map((it) => ({
            issueId: id,
            itemName: it.itemName,
            unit: it.unit,
            quantity: it.quantity,
          })),
        });
      }

      const updated = await tx.inventoryIssue.update({
        where: { id },
        data: {
          ...(dto.issueDate ? { issueDate: new Date(dto.issueDate) } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
        include: ISSUE_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_ISSUE',
          entityType: 'ISSUE',
          entityId: id,
          detail: `Cập nhật phiếu xuất ${existing.issueCode}`,
        },
      });

      return updated;
    });

    return this.serialize(issue);
  }

  // ---- Report / Check / Card ----

  /** Báo cáo NXT: Tồn cuối = Tồn đầu + Nhập − Xuất theo cơ sở & khoảng ngày. */
  async report(facilityId: string | undefined, from: string, to: string): Promise<InventoryReportResult> {
    const [{ receipts, issues }, supplierProducts] = await Promise.all([
      this.loadLedger(this.prisma, facilityId),
      this.prisma.supplierProduct.findMany({
        select: { name: true, unit: true, price: true, supplier: { select: { name: true } } },
      }),
    ]);

    const productPrices: Record<string, number> = {};
    const productSuppliers = new Map<string, Set<string>>();
    supplierProducts.forEach((sp) => {
      const key = inventoryKey(sp.name, sp.unit ?? '');
      productPrices[key] = Number(sp.price || 0);
      if (sp.supplier?.name) {
        const set = productSuppliers.get(key) ?? new Set<string>();
        set.add(sp.supplier.name);
        productSuppliers.set(key, set);
      }
    });

    const result = inventoryReport({
      purchaseReceipts: receipts,
      inventoryIssues: issues,
      facilityId: facilityId ?? '',
      from,
      to,
      productPrices,
    });

    return {
      ...result,
      rows: result.rows.map((row) => ({
        ...row,
        supplierName: [...(productSuppliers.get(row.key) ?? [])].join(', ') || undefined,
      })),
    };
  }

  /** Kiểm tra tồn khả dụng trước khi xuất — FE gọi để chặn ngay trên UI. */
  async check(dto: CheckIssueDto): Promise<CheckIssueResult> {
    const { receipts, issues } = await this.loadLedger(this.prisma, dto.facilityId);
    return canIssue({
      purchaseReceipts: receipts,
      inventoryIssues: issues,
      facilityId: dto.facilityId,
      issueDate: dto.issueDate,
      items: dto.items,
    });
  }

  /** Thẻ kho 1 mặt hàng: chuyển động theo thời gian + tồn luỹ kế. */
  async stockCard(params: {
    facilityId: string;
    itemName: string;
    unit: string;
    from: string;
    to: string;
  }): Promise<StockCardResult> {
    const key = inventoryKey(params.itemName, params.unit);
    const { receipts, issues } = await this.loadLedger(this.prisma, params.facilityId);

    interface Movement {
      date: string;
      code: string;
      type: 'NHAP' | 'XUAT';
      quantity: number;
    }
    const movements: Movement[] = [];

    for (const r of receipts) {
      if (r.status !== 'CONFIRMED') continue;
      for (const item of r.items ?? []) {
        if (inventoryKey(item.itemName, item.unit) === key) {
          movements.push({
            date: r.receiptDate.slice(0, 10),
            code: r.code,
            type: 'NHAP',
            quantity: Number(item.quantity),
          });
        }
      }
    }
    for (const i of issues) {
      if (i.status !== 'ACTIVE') continue;
      for (const item of i.items ?? []) {
        if (inventoryKey(item.itemName, item.unit) === key) {
          movements.push({
            date: i.issueDate.slice(0, 10),
            code: i.code,
            type: 'XUAT',
            quantity: Number(item.quantity),
          });
        }
      }
    }

    movements.sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));

    let balance = 0;
    let openingQty = 0;
    const entries = [];
    for (const m of movements) {
      const delta = m.type === 'NHAP' ? m.quantity : -m.quantity;
      if (m.date < params.from) {
        openingQty += delta;
        balance = openingQty;
        continue;
      }
      if (m.date > params.to) break;
      balance = (entries.length === 0 ? openingQty : balance) + delta;
      entries.push({ ...m, balance });
    }

    return {
      itemName: params.itemName,
      unit: params.unit,
      openingQty,
      entries,
      closingQty: entries.length ? entries[entries.length - 1].balance : openingQty,
    };
  }

  // ---- Helpers ----

  /** Nạp sổ kho: phiếu nhập + phiếu xuất (kèm code cho thẻ kho), Decimal → number. */
  private async loadLedger(
    client: LedgerClient,
    facilityId?: string,
  ): Promise<{
    receipts: (ReceiptLike & { code: string })[];
    issues: (IssueLike & { code: string })[];
  }> {
    const ids = facilityId ? facilityId.split(',').filter(Boolean) : [];
    const where = ids.length === 1 ? { facilityId: ids[0] } : ids.length > 1 ? { facilityId: { in: ids } } : {};
    const [receipts, issues] = await Promise.all([
      client.purchaseReceipt.findMany({ where, include: { items: true } }),
      client.inventoryIssue.findMany({ where, include: { items: true } }),
    ]);
    return {
      receipts: receipts.map((r) => ({
        code: r.receiptCode,
        facilityId: r.facilityId,
        receiptDate: r.receiptDate.toISOString(),
        status: r.status,
        items: r.items.map((i) => ({
          itemName: i.itemName,
          unit: i.unit,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice || 0),
        })),
      })),
      issues: issues.map((i) => ({
        code: i.issueCode,
        facilityId: i.facilityId,
        issueDate: i.issueDate.toISOString(),
        status: i.status,
        items: i.items.map((it) => ({
          itemName: it.itemName,
          unit: it.unit,
          quantity: Number(it.quantity),
        })),
      })),
    };
  }

  private serialize(i: IssueRow): IssueData {
    return {
      id: i.id,
      issueCode: i.issueCode,
      facilityId: i.facilityId,
      facilityName: i.facility.name,
      issueDate: i.issueDate.toISOString(),
      note: i.note,
      status: i.status,
      createdBy: i.createdBy,
      createdAt: i.createdAt.toISOString(),
      cancelledBy: i.cancelledBy,
      cancelledAt: i.cancelledAt?.toISOString() ?? null,
      items: i.items.map((it) => ({
        id: it.id,
        itemName: it.itemName,
        unit: it.unit,
        quantity: Number(it.quantity),
      })),
    };
  }
}
