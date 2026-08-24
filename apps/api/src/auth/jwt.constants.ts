// Cấu hình JWT — đọc từ env, có default an toàn cho dev.

export const jwtConstants = {
  accessSecret: () => process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret_change_me',
  refreshSecret: () => process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret_change_me',
  accessTtl: () => process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtl: () => process.env.JWT_REFRESH_TTL ?? '7d',
};

/** Payload trong JWT (access & refresh). */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: 'ADMIN' | 'STAFF';
  type: 'access' | 'refresh';
}

/** User gắn vào request sau khi JwtStrategy validate. */
export interface RequestUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
}

export const REFRESH_COOKIE = 'refresh_token';
