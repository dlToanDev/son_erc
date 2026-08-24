import type { AuditLogEntry, Paginated } from '@debtflow/shared';
import { apiGet } from './client';

export interface AuditFilter {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}

export const listAuditLogs = (filter: AuditFilter = {}) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return apiGet<Paginated<AuditLogEntry>>(`/audit-logs${qs ? `?${qs}` : ''}`);
};
