// DebtFlow / Garden Chay — Seed dữ liệu mẫu chuẩn từ 01/05/2026 đến 23/08/2026.
// Cấu hình: 1 Admin + 3 Nhân viên (Staff 1, Staff 2, Staff 3) + 3 Cơ sở (CS1, CS2, CS3).

import { PrismaClient, UserRole, EntityStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function reset() {
  await prisma.payment.deleteMany();
  await prisma.payable.deleteMany();
  await prisma.receiptItem.deleteMany();
  await prisma.purchaseReceipt.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.issueItem.deleteMany();
  await prisma.inventoryIssue.deleteMany();
  await prisma.supplierProduct.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.staffPermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.settings.deleteMany();
}

async function main() {
  await reset();

  // ---- Settings Singleton ----
  await prisma.settings.create({
    data: { id: 1, warningDays: 7, criticalWarningDays: 3, currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
  });

  // ---- 1 Admin + 3 Staff Accounts ----
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const admin = await prisma.user.create({
    data: {
      name: 'Quản trị viên',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@debtflow.local',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: UserRole.ADMIN,
      status: EntityStatus.ACTIVE,
    },
  });

  // Bộ quyền vận hành cho Nhân viên (STAFF): thao tác nghiệp vụ hằng ngày,
  // xem danh mục/nhật ký/dashboard — nhưng KHÔNG duyệt đơn, KHÔNG quản trị
  // người dùng/cài đặt, KHÔNG sửa danh mục sản phẩm, KHÔNG xem báo cáo nâng cao.
  const staffPermissions = [
    { module: 'suppliers', action: 'view', allowed: true },
    { module: 'suppliers', action: 'edit', allowed: true },
    { module: 'products', action: 'view', allowed: true },
    { module: 'orders', action: 'view', allowed: true },
    { module: 'orders', action: 'edit', allowed: true },
    { module: 'receipts', action: 'view', allowed: true },
    { module: 'receipts', action: 'edit', allowed: true },
    { module: 'payables', action: 'view', allowed: true },
    { module: 'payables', action: 'pay', allowed: true },
    { module: 'payments', action: 'view', allowed: true },
    { module: 'inventory', action: 'view', allowed: true },
    { module: 'inventory', action: 'edit', allowed: true },
    { module: 'audit', action: 'view', allowed: true },
    { module: 'dashboard', action: 'view', allowed: true },
  ];

  const staff1 = await prisma.user.create({
    data: {
      name: 'Nguyễn Văn Nam (Nhân viên CS1)',
      email: 'staff1@debtflow.local',
      passwordHash: await bcrypt.hash('staff123', 10),
      role: UserRole.STAFF,
      status: EntityStatus.ACTIVE,
      permissions: { create: staffPermissions },
    },
  });

  const staff2 = await prisma.user.create({
    data: {
      name: 'Trần Thị Mai (Nhân viên CS2)',
      email: 'staff2@debtflow.local',
      passwordHash: await bcrypt.hash('staff123', 10),
      role: UserRole.STAFF,
      status: EntityStatus.ACTIVE,
      permissions: { create: staffPermissions },
    },
  });

  const staff3 = await prisma.user.create({
    data: {
      name: 'Lê Hoàng Long (Nhân viên CS3)',
      email: 'staff3@debtflow.local',
      passwordHash: await bcrypt.hash('staff123', 10),
      role: UserRole.STAFF,
      status: EntityStatus.ACTIVE,
      permissions: { create: staffPermissions },
    },
  });

  // Tạo thêm tài khoản staff@debtflow.local để hỗ trợ đăng nhập cũ
  await prisma.user.create({
    data: {
      name: 'Nhân viên Mẫu (Mặc định)',
      email: 'staff@debtflow.local',
      passwordHash: await bcrypt.hash('staff123', 10),
      role: UserRole.STAFF,
      status: EntityStatus.ACTIVE,
      permissions: { create: staffPermissions },
    },
  });

  const staffList = [staff1, staff2, staff3];

  // ---- 3 Cơ sở (Facilities) ----
  const fac1 = await prisma.facility.create({
    data: { code: 'CS1', name: 'Cơ sở 1 - Kho Trung Tâm', address: '123 Cầu Giấy, Hà Nội' },
  });
  const fac2 = await prisma.facility.create({
    data: { code: 'CS2', name: 'Cơ sở 2 - Chi nhánh Hà Đông', address: '45 Quang Trung, Hà Đông, Hà Nội' },
  });
  const fac3 = await prisma.facility.create({
    data: { code: 'CS3', name: 'Cơ sở 3 - Chi nhánh Hoàn Kiếm', address: '88 Tràng Tiền, Hoàn Kiếm, Hà Nội' },
  });

  const facilities = [fac1, fac2, fac3];

  // ---- Danh mục Nhà cung cấp & Mặt hàng ----
  const sup1 = await prisma.supplier.create({
    data: {
      code: 'NCC001',
      name: 'Công ty Thực phẩm Chay An Phú',
      phone: '0901002003',
      email: 'anphu@supplier.vn',
      taxCode: '0109988776',
      contactPerson: 'Đỗ Thị Hạnh',
      address: 'Long Biên, Hà Nội',
      products: {
        create: [
          { name: 'Giò nấm chay', unit: 'Kg', price: 150000 },
          { name: 'Bì chay truyền thống', unit: 'Bao', price: 120000 },
          { name: 'Nấm đùi gà tươi', unit: 'Túi 1kg', price: 85000 },
          { name: 'Đậu hũ non hữu cơ', unit: 'Khay', price: 45000 },
        ],
      },
    },
    include: { products: true },
  });

  const sup2 = await prisma.supplier.create({
    data: {
      code: 'NCC002',
      name: 'Đồ uống & Nước giải khát Garden',
      phone: '0912345678',
      email: 'douong@supplier.vn',
      taxCode: '0101122334',
      contactPerson: 'Trần Văn Bình',
      address: 'Thanh Xuân, Hà Nội',
      products: {
        create: [
          { name: 'Bia Saigon Special', unit: 'Thùng', price: 240000 },
          { name: 'Nước khoáng Lavie 500ml', unit: 'Thùng', price: 95000 },
          { name: 'Nước trái cây ép lon', unit: 'Thùng', price: 210000 },
        ],
      },
    },
    include: { products: true },
  });

  const sup3 = await prisma.supplier.create({
    data: {
      code: 'NCC003',
      name: 'Nông sản & Gia vị Thuận Phát',
      phone: '0988776655',
      email: 'thuanphat@supplier.vn',
      taxCode: '0103344556',
      contactPerson: 'Lê Hoàng Nam',
      address: 'Hoàng Mai, Hà Nội',
      products: {
        create: [
          { name: 'Gạo thơm ST25', unit: 'Bao 10kg', price: 280000 },
          { name: 'Dầu ăn thực vật 5L', unit: 'Can', price: 220000 },
          { name: 'Nước tương đậu nành', unit: 'Chai', price: 35000 },
          { name: 'Hạt nêm nấm chay', unit: 'Gói 1kg', price: 65000 },
        ],
      },
    },
    include: { products: true },
  });

  // ---- Sinh dữ liệu chi tiết từ 01/05/2026 -> 23/08/2026 ----
  let receiptCounter = 100;
  let orderCounter = 100;

  const monthConfigs = [
    { year: 2026, month: 5, label: 'Tháng 5', count: 12, multiplier: 1.0 },
    { year: 2026, month: 6, label: 'Tháng 6', count: 15, multiplier: 1.25 },
    { year: 2026, month: 7, label: 'Tháng 7', count: 18, multiplier: 1.5 },
    { year: 2026, month: 8, label: 'Tháng 8', count: 21, multiplier: 1.8 },
  ];

  const suppliers = [sup1, sup2, sup3];

  for (const mCfg of monthConfigs) {
    // Tháng 8 chốt đến ngày 23/08/2026
    const daysInMonth = mCfg.month === 8 ? 23 : 28;

    for (let i = 0; i < mCfg.count; i++) {
      receiptCounter++;
      orderCounter++;

      const facIndex = i % 3;
      const fac = facilities[facIndex];
      const assignedStaff = staffList[facIndex];
      const sup = suppliers[i % 3];

      const day = Math.min(daysInMonth, Math.floor((i / mCfg.count) * daysInMonth) + 1);
      const receiptDate = new Date(Date.UTC(mCfg.year, mCfg.month - 1, day, 9, 0, 0));
      const dueDate = new Date(Date.UTC(mCfg.year, mCfg.month - 1, Math.min(28, day + 15), 17, 0, 0));

      const rCode = `PN-2026-${String(receiptCounter).padStart(3, '0')}`;
      const oCode = `DH-2026-${String(orderCounter).padStart(3, '0')}`;
      const invCode = `HD-${mCfg.month}-${String(i + 1).padStart(3, '0')}`;

      // Chọn sản phẩm & sản lượng
      const itemsToCreate = sup.products.map((prod, idx) => {
        const baseQty = (idx + 1) * 10 + (i % 5) * 5;
        const qty = Math.round(baseQty * mCfg.multiplier);
        return {
          itemName: prod.name,
          unit: prod.unit,
          quantity: qty,
          unitPrice: prod.price,
        };
      });

      const totalValue = itemsToCreate.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0);

      // 1. Tạo Đơn đặt hàng
      await prisma.purchaseOrder.create({
        data: {
          orderCode: oCode,
          supplierId: sup.id,
          facilityId: fac.id,
          status: 'APPROVED',
          note: `Đơn mua nguyên liệu ${mCfg.label} - ${fac.name}`,
          createdBy: assignedStaff.id,
          reviewedBy: admin.id,
          reviewedAt: receiptDate,
          items: {
            create: itemsToCreate.map((it) => {
              const p = sup.products.find((x) => x.name === it.itemName);
              return {
                productId: p?.id ?? sup.products[0].id,
                name: it.itemName,
                unit: it.unit,
                unitPrice: it.unitPrice,
                quantity: it.quantity,
              };
            }),
          },
        },
      });

      // 2. Tạo Phiếu nhập kho CONFIRMED
      const receipt = await prisma.purchaseReceipt.create({
        data: {
          receiptCode: rCode,
          supplierId: sup.id,
          facilityId: fac.id,
          supplierInvoiceCode: invCode,
          receiptDate,
          dueDate,
          status: 'CONFIRMED',
          createdBy: assignedStaff.id,
          confirmedBy: admin.id,
          items: {
            create: itemsToCreate.map((it) => ({
              itemName: it.itemName,
              unit: it.unit,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            })),
          },
        },
      });

      // 3. Tạo Công nợ Payable
      const payable = await prisma.payable.create({
        data: {
          invoiceCode: invCode,
          supplierId: sup.id,
          purchaseReceiptId: receipt.id,
          invoiceDate: receiptDate,
          dueDate,
          totalAmount: totalValue,
          description: `Công nợ nhập hàng ${mCfg.label} tại ${fac.name}`,
          createdBy: assignedStaff.id,
        },
      });

      // 4. Thanh toán công nợ
      if (mCfg.month <= 6 || (mCfg.month === 7 && i % 2 === 0)) {
        await prisma.payment.create({
          data: {
            payableId: payable.id,
            amount: totalValue,
            paymentDate: new Date(receiptDate.getTime() + 5 * 86400000),
            paymentMethod: 'BANK_TRANSFER',
            transactionCode: `FT26${mCfg.month}${String(i).padStart(3, '0')}`,
            note: 'Thanh toán chuyển khoản ngân hàng hoàn tất',
            createdBy: assignedStaff.id,
          },
        });
      } else if (mCfg.month === 7) {
        await prisma.payment.create({
          data: {
            payableId: payable.id,
            amount: Math.round(totalValue * 0.4),
            paymentDate: new Date(receiptDate.getTime() + 10 * 86400000),
            paymentMethod: 'BANK_TRANSFER',
            transactionCode: `FT2607${String(i).padStart(3, '0')}`,
            note: 'Thanh toán đợt 1 (40%)',
            createdBy: assignedStaff.id,
          },
        });
      } else if (mCfg.month === 8 && i % 3 === 0) {
        await prisma.payment.create({
          data: {
            payableId: payable.id,
            amount: Math.round(totalValue * 0.5),
            paymentDate: new Date(receiptDate.getTime() + 3 * 86400000),
            paymentMethod: 'CASH',
            transactionCode: `TM2608${String(i).padStart(3, '0')}`,
            note: 'Thanh toán tiền mặt đợt 1',
            createdBy: assignedStaff.id,
          },
        });
      }

      // 5. Tạo Phiếu Xuất kho mẫu (Inventory Issue)
      if (i % 2 === 0) {
        await prisma.inventoryIssue.create({
          data: {
            issueCode: `PX-2026-${String(receiptCounter).padStart(3, '0')}`,
            facilityId: fac.id,
            issueDate: new Date(receiptDate.getTime() + 2 * 86400000),
            note: `Xuất kho chế biến ${mCfg.label} - ${fac.name}`,
            createdBy: assignedStaff.id,
            items: {
              create: itemsToCreate.slice(0, 2).map((it) => ({
                itemName: it.itemName,
                unit: it.unit,
                quantity: Math.round(it.quantity * 0.65),
              })),
            },
          },
        });
      }
    }
  }

  // ---- Audit log ----
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SEED',
      entityType: 'SYSTEM',
      detail: 'Khởi tạo thành công dữ liệu mẫu từ 01/05/2026 đến 23/08/2026 cho 1 Admin, 3 NV và 3 CS',
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed dữ liệu mẫu thành công (01/05/2026 ➔ 23/08/2026):');
  // eslint-disable-next-line no-console
  console.log(`  👑 1 Admin: ${admin.email} (Mật khẩu: ${adminPassword})`);
  // eslint-disable-next-line no-console
  console.log(`  👥 3 Nhân viên:`);
  // eslint-disable-next-line no-console
  console.log(`     - ${staff1.name}: ${staff1.email} / staff123`);
  // eslint-disable-next-line no-console
  console.log(`     - ${staff2.name}: ${staff2.email} / staff123`);
  // eslint-disable-next-line no-console
  console.log(`     - ${staff3.name}: ${staff3.email} / staff123`);
  // eslint-disable-next-line no-console
  console.log(`  🏢 3 Cơ sở: ${fac1.name}, ${fac2.name}, ${fac3.name}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
