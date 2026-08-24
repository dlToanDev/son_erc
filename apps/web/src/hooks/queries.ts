// Chuẩn hoá TanStack Query: queryKey + invalidate tập trung.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/masterData';
import * as ordersApi from '../api/orders';
import * as financeApi from '../api/finance';
import * as inventoryApi from '../api/inventory';
import * as reportsApi from '../api/reports';
import * as auditApi from '../api/audit';
import type { RangeValue } from '@debtflow/shared';

export const keys = {
  facilities: ['facilities'] as const,
  suppliers: (search?: string) => ['suppliers', search ?? ''] as const,
  supplier: (id: string) => ['supplier', id] as const,
  products: (supplierId: string) => ['products', supplierId] as const,
  users: ['users'] as const,
  settings: ['settings'] as const,
  latestBackup: ['latest-backup'] as const,
  orders: (facilityId?: string, status?: string) =>
    ['orders', facilityId ?? '', status ?? ''] as const,
  order: (id: string) => ['order', id] as const,
  pendingCount: ['orders', 'pending-count'] as const,
  receipts: (f?: Record<string, string | undefined>) => ['receipts', f ?? {}] as const,
  receipt: (id: string) => ['receipt', id] as const,
  payables: (f?: Record<string, string | undefined>) => ['payables', f ?? {}] as const,
  payable: (id: string) => ['payable', id] as const,
  payments: (f?: Record<string, string | undefined>) => ['payments', f ?? {}] as const,
  issues: (f?: Record<string, string | undefined>) => ['issues', f ?? {}] as const,
  invReport: (from: string, to: string, facilityId?: string) =>
    ['inventory-report', from, to, facilityId ?? ''] as const,
  stockCard: (p: Record<string, string>) => ['stock-card', p] as const,
};

// ---- Facilities ----
export const useFacilities = () =>
  useQuery({ queryKey: keys.facilities, queryFn: api.listFacilities });

export const useFacilityMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.facilities });
  return {
    create: useMutation({
      mutationFn: api.createFacility,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.updateFacility>[1]) =>
        api.updateFacility(id, body),
      onSuccess: invalidate,
    }),
  };
};

// ---- Suppliers ----
export const useSuppliers = (search?: string) =>
  useQuery({ queryKey: keys.suppliers(search), queryFn: () => api.listSuppliers(search) });

export const useSupplier = (id: string) =>
  useQuery({ queryKey: keys.supplier(id), queryFn: () => api.getSupplier(id), enabled: !!id });

export const useSupplierMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['suppliers'] });
  return {
    create: useMutation({ mutationFn: api.createSupplier, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.updateSupplier>[1]) =>
        api.updateSupplier(id, body),
      onSuccess: (_data, vars) => {
        invalidate();
        qc.invalidateQueries({ queryKey: keys.supplier(vars.id) });
      },
    }),
  };
};

// ---- Products ----
export const useProducts = (supplierId: string) =>
  useQuery({
    queryKey: keys.products(supplierId),
    queryFn: () => api.listProducts(supplierId),
    enabled: !!supplierId,
  });

export const useProductMutations = (supplierId: string) => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.products(supplierId) });
  return {
    create: useMutation({
      mutationFn: (body: Parameters<typeof api.createProduct>[1]) =>
        api.createProduct(supplierId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        productId,
        ...body
      }: { productId: string } & Parameters<typeof api.updateProduct>[2]) =>
        api.updateProduct(supplierId, productId, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (productId: string) => api.deleteProduct(supplierId, productId),
      onSuccess: invalidate,
    }),
  };
};

// ---- Users ----
export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: api.listUsers });

export const useUserMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.users });
  return {
    create: useMutation({ mutationFn: api.createUser, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.updateUser>[1]) =>
        api.updateUser(id, body),
      onSuccess: invalidate,
    }),
    setPermissions: useMutation({
      mutationFn: ({ id, permissions }: { id: string; permissions: Parameters<typeof api.setUserPermissions>[1] }) =>
        api.setUserPermissions(id, permissions),
      onSuccess: invalidate,
    }),
  };
};

// ---- Orders ----
export const useOrders = (facilityId?: string, status?: string) =>
  useQuery({
    queryKey: keys.orders(facilityId, status),
    queryFn: () => ordersApi.listOrders({ facilityId, status }),
    placeholderData: (prev) => prev,
  });

export const useOrder = (id: string) =>
  useQuery({ queryKey: keys.order(id), queryFn: () => ordersApi.getOrder(id), enabled: !!id });

export const usePendingCount = (enabled: boolean) =>
  useQuery({
    queryKey: keys.pendingCount,
    queryFn: ordersApi.getPendingCount,
    enabled,
    refetchInterval: 30_000,
  });

export const useOrderMutations = () => {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ['orders'] });
    if (id) qc.invalidateQueries({ queryKey: keys.order(id) });
  };
  return {
    create: useMutation({ mutationFn: ordersApi.createOrder, onSuccess: () => invalidate() }),
    approve: useMutation({
      mutationFn: ordersApi.approveOrder,
      onSuccess: (_d, vars) => invalidate(typeof vars === 'string' ? vars : vars.id),
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        ordersApi.rejectOrder(id, reason),
      onSuccess: (_d, vars) => invalidate(vars.id),
    }),
    cancel: useMutation({
      mutationFn: ordersApi.cancelOrder,
      onSuccess: (_d, id) => invalidate(id),
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ordersApi.UpdateOrderInput }) =>
        ordersApi.updateOrder(id, body),
      onSuccess: (_d, vars) => invalidate(vars.id),
    }),
  };
};

// ---- Receipts ----
export const useReceipts = (filter?: { supplierId?: string; facilityId?: string; status?: string }) =>
  useQuery({
    queryKey: keys.receipts(filter),
    queryFn: () => financeApi.listReceipts(filter),
    placeholderData: (prev) => prev,
  });

export const useReceipt = (id: string) =>
  useQuery({ queryKey: keys.receipt(id), queryFn: () => financeApi.getReceipt(id), enabled: !!id });

export const useReceiptMutations = () => {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ['receipts'] });
    qc.invalidateQueries({ queryKey: ['payables'] });
    qc.invalidateQueries({ queryKey: ['suppliers'] });
    if (id) qc.invalidateQueries({ queryKey: keys.receipt(id) });
  };
  return {
    create: useMutation({ mutationFn: financeApi.createReceipt, onSuccess: () => invalidate() }),
    confirm: useMutation({
      mutationFn: financeApi.confirmReceipt,
      onSuccess: (_d, id) => invalidate(id),
    }),
  };
};

// ---- Payables ----
export const usePayables = (filter?: { supplierId?: string; status?: string }) =>
  useQuery({
    queryKey: keys.payables(filter),
    queryFn: () => financeApi.listPayables(filter),
    placeholderData: (prev) => prev,
  });

export const usePayable = (id: string) =>
  useQuery({ queryKey: keys.payable(id), queryFn: () => financeApi.getPayable(id), enabled: !!id });

// ---- Payments ----
export const usePayments = (filter?: { payableId?: string; supplierId?: string }) =>
  useQuery({
    queryKey: keys.payments(filter),
    queryFn: () => financeApi.listPayments(filter),
    placeholderData: (prev) => prev,
  });

export const usePaymentMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payments'] });
    qc.invalidateQueries({ queryKey: ['payables'] });
    qc.invalidateQueries({ queryKey: ['payable'] });
    qc.invalidateQueries({ queryKey: ['suppliers'] });
  };
  return {
    create: useMutation({ mutationFn: financeApi.createPayment, onSuccess: invalidate }),
    void: useMutation({ mutationFn: financeApi.voidPayment, onSuccess: invalidate }),
  };
};

// ---- Inventory ----
export const useIssues = (filter?: { facilityId?: string; status?: string }) =>
  useQuery({
    queryKey: keys.issues(filter),
    queryFn: () => inventoryApi.listIssues(filter),
    placeholderData: (prev) => prev,
  });

export const useInventoryReport = (from: string, to: string, facilityId?: string) =>
  useQuery({
    queryKey: keys.invReport(from, to, facilityId),
    queryFn: () => inventoryApi.getReport(from, to, facilityId),
    enabled: !!from && !!to,
    placeholderData: (prev) => prev,
  });

export const useStockCard = (
  params: { facilityId: string; itemName: string; unit: string; from: string; to: string } | null,
) =>
  useQuery({
    queryKey: keys.stockCard((params ?? {}) as Record<string, string>),
    queryFn: () => inventoryApi.getStockCard(params!),
    enabled: !!params,
    placeholderData: (prev) => prev,
  });

export const useIssueMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['issues'] });
    qc.invalidateQueries({ queryKey: ['inventory-report'] });
    qc.invalidateQueries({ queryKey: ['stock-card'] });
  };
  return {
    create: useMutation({ mutationFn: inventoryApi.createIssue, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Partial<inventoryApi.IssueInput>) =>
        inventoryApi.updateIssue(id, body),
      onSuccess: invalidate,
    }),
    cancel: useMutation({ mutationFn: inventoryApi.cancelIssue, onSuccess: invalidate }),
  };
};

// ---- Reports ----
export const useDashboard = (range: RangeValue, facilityId?: string) =>
  useQuery({
    queryKey: ['dashboard', range, facilityId ?? ''],
    queryFn: () => reportsApi.getDashboard(range, facilityId),
    placeholderData: (prev) => prev,
  });

export const useDebtAlertCounts = () =>
  useQuery({
    queryKey: ['debt-alert-counts'],
    queryFn: reportsApi.getDebtAlertCounts,
    refetchInterval: 60_000,
  });

export const useStats = (range: RangeValue, facilityId?: string, from?: string, to?: string) =>
  useQuery({
    queryKey: ['stats', range, facilityId ?? '', from ?? '', to ?? ''],
    queryFn: () => reportsApi.getStats(range, facilityId, from, to),
    placeholderData: (prev) => prev,
  });

export const useCompare = (
  periods: { fromA: string; toA: string; fromB: string; toB: string } | null,
  facilityId?: string,
) =>
  useQuery({
    queryKey: ['compare', periods, facilityId ?? ''],
    queryFn: () => reportsApi.getCompare(periods!, facilityId),
    enabled: !!periods,
    placeholderData: (prev) => prev,
  });

// ---- Audit ----
export const useAuditLogs = (filter: auditApi.AuditFilter) =>
  useQuery({
    queryKey: ['audit-logs', filter],
    queryFn: () => auditApi.listAuditLogs(filter),
    placeholderData: (prev) => prev, // giữ trang cũ khi chuyển trang
  });

// ---- Settings ----
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: api.getSettings });

export const useSettingsMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
};

// ---- Backup / Restore ----
export const useLatestBackup = () =>
  useQuery({ queryKey: keys.latestBackup, queryFn: api.getLatestBackup });

export const useRestoreLatestBackup = () =>
  useMutation({ mutationFn: (confirm: string) => api.restoreLatestBackup(confirm) });
