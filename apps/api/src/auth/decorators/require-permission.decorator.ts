import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  module: string;
  action: string;
}

/**
 * Khai báo quyền cần có cho endpoint: @RequirePermission('suppliers', 'edit').
 * Dùng kèm JwtAuthGuard + PermissionGuard.
 */
export const RequirePermission = (module: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { module, action } satisfies RequiredPermission);
