// Kiểu dữ liệu chung FE + BE.

/** Envelope lỗi chuẩn của API. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** Kết quả phân trang chuẩn. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Payload health-check. */
export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

// ---------- Auth ----------

/** Một quyền của staff: module → action. */
export interface PermissionEntry {
  module: string;
  action: string;
  allowed: boolean;
}

/** Thông tin user trả về FE — KHÔNG bao giờ chứa password_hash. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  permissions: PermissionEntry[];
}

/** Kết quả đăng nhập / refresh. */
export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}
