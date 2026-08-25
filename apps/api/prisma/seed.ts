// DebtFlow / Garden Chay — Seed dữ liệu mẫu chuẩn từ 01/05/2026 đến 25/08/2026.
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

  // ---- Danh mục Nhà cung cấp & Mặt hàng (9 NCC — giá danh mục = 0, nhập sau) ----

  // NCC004 — Homefood: danh mục mặt hàng (giá sẽ cập nhật sau).
  const sup4 = await prisma.supplier.create({
    data: {
      code: 'NCC004',
      name: 'Homefood',
      products: {
        create: [
          { name: 'Sốt Dầu Hào', unit: 'kg', price: 0 },
          { name: 'Sốt Kho', unit: 'kg', price: 0 },
          { name: 'Sốt Nấm', unit: 'kg', price: 0 },
          { name: 'Cốt Lẩu Nấm', unit: 'Kg', price: 0 },
          { name: 'Cốt Phở vị mộc', unit: 'Kg', price: 0 },
          { name: 'Sốt Mè', unit: 'kg', price: 0 },
          { name: 'Sa Tế Chay', unit: 'kg', price: 0 },
          { name: 'BB Bí Đỏ', unit: 'khay', price: 0 },
          { name: 'BB Rau Củ', unit: 'Khay', price: 0 },
          { name: 'Đạm Bò Chay', unit: 'kg', price: 0 },
          { name: 'Mọc Chay', unit: 'kg', price: 0 },
          { name: 'Mì rau củ', unit: 'túi', price: 0 },
          { name: 'Bate mít', unit: 'hộp', price: 0 },
          { name: 'Chả Mít', unit: 'kg', price: 0 },
          { name: 'Mì căn', unit: 'kg', price: 0 },
        ],
      },
    },
    include: { products: true },
  });

  // NCC005 — Hương đồ khô: danh mục mặt hàng khô/gia vị/vật tư (giá cập nhật sau).
  const sup5 = await prisma.supplier.create({
    data: {
      code: 'NCC005',
      name: 'Hương đồ khô',
      products: {
        create: [
          { name: 'Hạt Sen', unit: 'kg' },
          { name: 'Đỗ Xanh', unit: 'kg' },
          { name: 'Bột Thính', unit: 'túi' },
          { name: 'Mầu Điều', unit: 'hộp' },
          { name: 'Bột Canh I Ốt', unit: 'túi' },
          { name: 'Muối', unit: 'túi' },
          { name: 'Đường', unit: 'kg' },
          { name: 'Lạc', unit: 'kg' },
          { name: 'Vừng', unit: 'Kg' },
          { name: 'Ớt Bột', unit: 'túi' },
          { name: 'Tiêu Đen', unit: 'kg' },
          { name: 'Túi Rác Đen', unit: 'kg' },
          { name: 'Túi Nylon', unit: 'kg' },
          { name: 'Găng Tay Nylon', unit: 'kg' },
          { name: 'Nước Cốt Dừa', unit: 'hộp' },
          { name: 'Sữa Đặc', unit: 'hộp' },
          { name: 'Chai Nhựa 300ml', unit: 'chai' },
          { name: 'Cốc Nhựa 700ml', unit: 'dây' },
          { name: 'Trà Sâm Dứa', unit: 'túi' },
          { name: 'Miến Khô', unit: 'túi' },
          { name: 'Sốt Cà Chua', unit: 'can' },
          { name: 'Tương Ớt', unit: 'can' },
          { name: 'Tương quê tôi', unit: 'can' },
          { name: 'Bột Béo', unit: 'túi' },
          { name: 'Mộc Nhĩ', unit: 'kg' },
          { name: 'Bột Năng', unit: 'túi' },
          { name: 'Bột Chiên Xù', unit: 'túi' },
          { name: 'Đẳng Sâm', unit: 'kg' },
          { name: 'Kỳ Tử', unit: 'kg' },
          { name: 'Quế', unit: 'kg' },
          { name: 'Hoa Hồi', unit: 'kg' },
          { name: 'Thảo Quả', unit: 'kg' },
          { name: 'Me Thái', unit: 'hộp' },
          { name: 'Chà Là', unit: 'hộp' },
          { name: 'Bột Sư Tử', unit: 'hộp' },
          { name: 'Bột Chiên Giòn', unit: 'túi' },
          { name: 'Dấm Trắng', unit: 'can' },
          { name: 'Táo Đỏ', unit: 'kg' },
          { name: 'Hoài Sơn', unit: 'kg' },
          { name: 'Giấy Ăn', unit: 'bịch' },
          { name: 'Đũa thìa', unit: 'túi' },
          { name: 'Xì Dầu Đặc Biệt', unit: 'chai' },
          { name: 'Hạt Điều', unit: 'kg' },
          { name: 'Gạo Đen', unit: 'bao' },
          { name: 'Dầu Ăn', unit: 'can' },
          { name: 'Gạo Hồng', unit: 'bao' },
          { name: 'Gạo Trắng', unit: 'bao' },
          { name: 'Nước Mắm', unit: 'chai' },
          { name: 'túi đỏ to', unit: 'kg' },
          { name: 'Nấm Hương', unit: 'kg' },
          { name: 'Dầu Hào', unit: 'chai' },
          { name: 'Váng Đậu Chiên', unit: 'túi' },
        ],
      },
    },
    include: { products: true },
  });

  // NCC006 — Chợ Đồng Xuân: danh mục mặt hàng (giá cập nhật sau).
  const sup6 = await prisma.supplier.create({
    data: {
      code: 'NCC006',
      name: 'Chợ Đồng Xuân',
      products: {
        create: [
          { name: 'Nấm Đông Cô', unit: 'túi' },
          { name: 'túi đỏ nhỏ', unit: 'kg' },
          { name: 'Rong Biển Khô nấu', unit: 'túi' },
          { name: 'Rong Biển Cuộn', unit: 'túi' },
          { name: 'Hạt Nêm', unit: 'túi' },
          { name: 'Hạnh Nhân', unit: 'kg' },
          { name: 'Nho Khô', unit: 'kg' },
          { name: 'Bột Ngọt Gà', unit: 'túi' },
          { name: 'Giò Chay', unit: 'cái' },
          { name: 'Chả Quế Chay', unit: 'túi' },
          { name: 'Chả Bao Xả', unit: 'túi' },
        ],
      },
    },
    include: { products: true },
  });

  // NCC007 — Phở khô: danh mục mặt hàng (giá cập nhật sau).
  const sup7 = await prisma.supplier.create({
    data: {
      code: 'NCC007',
      name: 'Phở khô',
      products: {
        create: [
          { name: 'Phở Khô', unit: 'kg' },
          { name: 'Bánh Đa Nem', unit: 'kg' },
          { name: 'Bún Khô', unit: 'kg' },
        ],
      },
    },
    include: { products: true },
  });

  // NCC008 — Bánh Đa Vừng Mặt Hừng: danh mục mặt hàng (giá cập nhật sau).
  const sup8 = await prisma.supplier.create({
    data: {
      code: 'NCC008',
      name: 'Bánh Đa Vừng Mặt Hừng',
      products: {
        create: [
          { name: 'Bánh Đa Vừng', unit: 'kg' },
        ],
      },
    },
    include: { products: true },
  });

  // NCC009 — Vỏ Há Cảo: danh mục mặt hàng (giá cập nhật sau).
  const sup9 = await prisma.supplier.create({
    data: {
      code: 'NCC009',
      name: 'Vỏ Há Cảo',
      products: {
        create: [
          { name: 'Vỏ Há Cảo', unit: 'cái' },
        ],
      },
    },
    include: { products: true },
  });

  // NCC010 — Váng Đậu Tươi: danh mục mặt hàng (giá cập nhật sau).
  const sup10 = await prisma.supplier.create({
    data: {
      code: 'NCC010',
      name: 'Váng Đậu Tươi',
      products: {
        create: [
          { name: 'Váng Đậu Tươi', unit: 'túi' },
        ],
      },
    },
    include: { products: true },
  });

  // NCC011 — Nước Lavie: danh mục mặt hàng (giá cập nhật sau).
  const sup11 = await prisma.supplier.create({
    data: {
      code: 'NCC011',
      name: 'Nước Lavie',
      products: {
        create: [
          { name: 'Nước Lavie', unit: 'chai' },
          { name: 'Bia Ken', unit: 'lon' },
          { name: 'Bia 0 Độ', unit: 'lon' },
          { name: 'Nước Ngọt', unit: 'lon' },
        ],
      },
    },
    include: { products: true },
  });

  // NCC012 — Bát Giấy To: danh mục mặt hàng (giá cập nhật sau).
  const sup12 = await prisma.supplier.create({
    data: {
      code: 'NCC012',
      name: 'Bát Giấy To',
      products: {
        create: [
          { name: 'Bát Giấy To', unit: 'hộp' },
          { name: 'Bát Giấy Nhỡ', unit: 'hộp' },
          { name: 'Tảo Xoắn', unit: 'kg' },
        ],
      },
    },
    include: { products: true },
  });

  // ---- Sinh dữ liệu chi tiết từ 01/05/2026 -> 25/08/2026 ----
  let receiptCounter = 100;
  let orderCounter = 100;

  const monthConfigs = [
    { year: 2026, month: 5, label: 'Tháng 5', count: 12, multiplier: 1.0 },
    { year: 2026, month: 6, label: 'Tháng 6', count: 15, multiplier: 1.25 },
    { year: 2026, month: 7, label: 'Tháng 7', count: 18, multiplier: 1.5 },
    { year: 2026, month: 8, label: 'Tháng 8', count: 21, multiplier: 1.8 },
  ];

  const suppliers = [sup4, sup5, sup6, sup7, sup8, sup9, sup10, sup11, sup12];

  // Bảng giá TẠM cho dữ liệu demo (danh mục sản phẩm vẫn giữ price = 0 để nhập sau).
  const UNIT_BASE_PRICE: Record<string, number> = {
    kg: 60000, túi: 25000, hộp: 40000, khay: 35000, can: 90000,
    chai: 30000, lon: 15000, cái: 20000, dây: 50000, bao: 280000, bịch: 30000,
  };
  const demoPriceById = new Map<string, number>();
  let priceSeed = 0;
  for (const s of suppliers) {
    for (const p of s.products) {
      priceSeed += 1;
      const base = UNIT_BASE_PRICE[p.unit.trim().toLowerCase()] ?? 30000;
      const variance = 0.85 + ((priceSeed * 37) % 31) / 100; // 0.85 .. 1.15
      demoPriceById.set(p.id, Math.round((base * variance) / 1000) * 1000);
    }
  }

  for (const mCfg of monthConfigs) {
    // Tháng 8 chốt đến ngày 25/08/2026
    const daysInMonth = mCfg.month === 8 ? 25 : 28;

    for (let i = 0; i < mCfg.count; i++) {
      receiptCounter++;
      orderCounter++;

      const facIndex = i % 3;
      const fac = facilities[facIndex];
      const assignedStaff = staffList[facIndex];
      const sup = suppliers[i % suppliers.length];

      const day = Math.min(daysInMonth, Math.floor((i / mCfg.count) * daysInMonth) + 1);
      const receiptDate = new Date(Date.UTC(mCfg.year, mCfg.month - 1, day, 9, 0, 0));
      const dueDate = new Date(Date.UTC(mCfg.year, mCfg.month - 1, Math.min(28, day + 15), 17, 0, 0));

      const rCode = `PN-2026-${String(receiptCounter).padStart(3, '0')}`;
      const oCode = `DH-2026-${String(orderCounter).padStart(3, '0')}`;
      const invCode = `HD-${mCfg.month}-${String(i + 1).padStart(3, '0')}`;

      // Chọn 1 nhóm mặt hàng xoay vòng của NCC (không lấy toàn bộ để phiếu gọn & thực tế)
      const prodCount = sup.products.length;
      const take = Math.min(6, prodCount);
      const startIdx = prodCount > 0 ? (i * 2) % prodCount : 0;
      const chosenProducts = Array.from({ length: take }, (_, k) => sup.products[(startIdx + k) % prodCount]);
      const itemsToCreate = chosenProducts.map((prod, idx) => {
        const baseQty = (idx + 1) * 10 + (i % 5) * 5;
        const qty = Math.round(baseQty * mCfg.multiplier);
        return {
          itemName: prod.name,
          unit: prod.unit,
          quantity: qty,
          unitPrice: demoPriceById.get(prod.id) ?? 0,
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
      detail: 'Khởi tạo thành công dữ liệu mẫu từ 01/05/2026 đến 25/08/2026 cho 1 Admin, 3 NV và 3 CS',
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed dữ liệu mẫu thành công (01/05/2026 ➔ 25/08/2026):');
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
