import type {
  Facility,
  PermissionEntry,
  SettingsData,
  Supplier,
  SupplierProduct,
  SupplierWithTotals,
  UserSummary,
} from '@debtflow/shared';
import { apiFetch, apiGet, apiPost } from './client';

const apiPatch = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const apiPut = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const apiDelete = <T>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' });

// ---- Facilities ----
export const listFacilities = () => apiGet<Facility[]>('/facilities');
export const createFacility = (body: { code: string; name: string; address?: string }) =>
  apiPost<Facility>('/facilities', body);
export const updateFacility = (id: string, body: Partial<Omit<Facility, 'id' | 'code'>>) =>
  apiPatch<Facility>(`/facilities/${id}`, body);

// ---- Suppliers ----
export const listSuppliers = (search?: string) =>
  apiGet<SupplierWithTotals[]>(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
export const getSupplier = (id: string) => apiGet<SupplierWithTotals>(`/suppliers/${id}`);
export const createSupplier = (body: Partial<Supplier> & { code: string; name: string }) =>
  apiPost<Supplier>('/suppliers', body);
export const updateSupplier = (id: string, body: Partial<Supplier>) =>
  apiPatch<Supplier>(`/suppliers/${id}`, body);

// ---- Products ----
export const listProducts = (supplierId: string) =>
  apiGet<SupplierProduct[]>(`/suppliers/${supplierId}/products`);
export const createProduct = (
  supplierId: string,
  body: { name: string; unit: string; price: number; note?: string },
) => apiPost<SupplierProduct>(`/suppliers/${supplierId}/products`, body);
export const updateProduct = (
  supplierId: string,
  productId: string,
  body: Partial<Omit<SupplierProduct, 'id' | 'supplierId'>>,
) => apiPatch<SupplierProduct>(`/suppliers/${supplierId}/products/${productId}`, body);
export const deleteProduct = (supplierId: string, productId: string) =>
  apiDelete<{ success: boolean }>(`/suppliers/${supplierId}/products/${productId}`);

// ---- Users ----
export type UserWithPermissions = UserSummary & { permissions: PermissionEntry[] };
export const listUsers = () => apiGet<UserWithPermissions[]>('/users');
export const createUser = (body: {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'STAFF';
}) => apiPost<UserSummary>('/users', body);
export const updateUser = (
  id: string,
  body: Partial<{ name: string; email: string; password: string; role: 'ADMIN' | 'STAFF'; status: 'ACTIVE' | 'INACTIVE' }>,
) => apiPatch<UserSummary>(`/users/${id}`, body);
export const setUserPermissions = (id: string, permissions: PermissionEntry[]) =>
  apiPut<PermissionEntry[]>(`/users/${id}/permissions`, { permissions });

// ---- Settings ----
export const getSettings = () => apiGet<SettingsData>('/settings');
export const updateSettings = (body: Partial<SettingsData>) =>
  apiPut<SettingsData>('/settings', body);

// ---- Backup / Restore ----
export interface BackupInfo {
  fileName: string;
  createdAt: string; // ISO
}
export interface RestoreResult {
  restoredFrom: string;
  backupTime: string;
}
export const getLatestBackup = () => apiGet<BackupInfo | null>('/settings/latest-backup');
export const restoreLatestBackup = (confirm: string) =>
  apiPost<RestoreResult>('/settings/restore-latest', { confirm });
