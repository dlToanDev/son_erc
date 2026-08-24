# Phase 2 — Auth + RBAC + Phân quyền

**Mục tiêu:** Bảo mật trục xương sống trước khi mở nghiệp vụ.

## Backend

- [x] `POST /auth/login` — email + mật khẩu → JWT
- [x] `POST /auth/refresh` — refresh token (cookie httpOnly, ~7 ngày, xoay mỗi lần)
- [x] `GET /auth/me` — thông tin user hiện tại (+ `POST /auth/logout`)
- [x] JWT access ~15 phút, bcrypt băm mật khẩu
- [x] `JwtAuthGuard` — xác thực token (chỉ nhận type=access)
- [x] `PermissionGuard` — kiểm tra `PermissionSet` (module → action) **phía server**
  - ADMIN: toàn quyền
  - STAFF: theo quyền được cấp (view/edit/pay...)
- [x] Rate-limit đăng nhập (5 lần/phút → 429)
- [x] CORS chặt (origin qua env, credentials)
- [x] Validate DTO đầu vào (class-validator, whitelist + forbidNonWhitelisted)
- [x] Ẩn thông tin nhạy cảm khỏi response (password_hash...)

## Frontend

- [x] Trang **Đăng nhập** (email + mật khẩu)
- [x] Zustand store auth (kèm helper `can(module, action)`)
- [x] Điều hướng theo vai trò sau đăng nhập
- [x] Fetch interceptor: gắn Bearer + tự refresh 1 lần khi 401 rồi retry
- [x] Route guard `RequireAuth` (khôi phục phiên từ refresh cookie khi mở app)

## Definition of Done

- Login/refresh hoạt động end-to-end.
- Endpoint được bảo vệ trả 401 (chưa auth) / 403 (thiếu quyền) đúng.
- STAFF bị chặn đúng theo `PermissionSet` khi kiểm tra phía server.
