// Types nhật ký kiểm toán dùng chung FE + BE (Phase 8).

export interface AuditLogEntry {
  id: string;
  time: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: string | null;
}
