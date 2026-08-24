# DebtFlow — Kiểm toàn diện 4 mục (2026-08-24)

Bổ sung ngoài 81 test e2e. Chạy trên API thật (build dist) + Postgres tạm đã seed + FE Playwright.

## Mục 1 — Endpoint (ngoài phạm vi 81 e2e)
Quét sống toàn bộ ~45 route trên API thật:
- **35/35** kiểm READ + RBAC + validation: mọi GET admin → 200; staff bị chặn đúng (`/users`, `/reports/stats`, POST products, PUT settings → 403); staff được phép đúng (suppliers/audit/dashboard/payables → 200); no-token → 401; route lạ / id lạ → 404; DTO thiếu field / field lạ (`forbidNonWhitelisted`) / `range=5y` / ngày sai → 400.
- **11/11** mutation các endpoint e2e CHƯA phủ: `DELETE /suppliers/:id/products/:pid` (admin 200, staff 403), `PUT /orders/:id` (200), `PUT /inventory/issues/:id` (200), `POST /auth/logout` (201).
- **Rate-limit đăng nhập hoạt động**: sau 5 lần/phút → **429** (chống brute-force). ✅
- Kết luận: không phát hiện endpoint hỏng.

## Mục 2 — Cấu hình production (audit tĩnh + validate)
- `docker-compose.prod.yml` **parse hợp lệ**; mọi secret bắt buộc qua `${VAR:?}` → thiếu là fail-fast. ✅
- Cookie refresh: `httpOnly=true`, `secure` khi `NODE_ENV=production`, `sameSite=lax`. ✅
- Nginx: security headers (X-Content-Type-Options/X-Frame-Options/Referrer-Policy), gzip, `client_max_body_size 5m`, SPA fallback, ACME. ✅
- Có sẵn: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `deploy/backup.sh` (pg_dump định kỳ + retention), `deploy/init-letsencrypt.sh`, `nginx-ssl.conf.template`, GitHub Actions. Migrate tự chạy ở entrypoint. ✅
- **Việc bạn PHẢI làm khi deploy** (không phải lỗi code): điền `.env` production thật (đổi `DOI_..._NAY`, sinh JWT bằng `openssl rand -base64 48`), đặt `CORS_ORIGIN` = domain thật, đổi mật khẩu admin sau seed, firewall chỉ mở 22/80/443.

## Mục 3 — Smoke Frontend (Playwright) → **3/3 pass**
Chạy stack thật (API + vite + DB seed). Ban đầu fail do **drift FE↔seed/branding**, đã sửa `apps/web/e2e/smoke.spec.ts`:
- `'DebtFlow'` → `'Garden Chay'` (app đã đổi thương hiệu).
- Tên NCC `'...An Phú'` → `'...Chay An Phú'`; bỏ mã cứng `'NCC-HD-001'` (seed dùng `HD-5-001`...).
- Audit `'Đăng nhập hệ thống'`/`'LOGIN'`: dùng `getByRole('cell')` tránh trùng `<option>` lọc + span mobile ẩn (strict-mode).
- Test staff: staff điều hướng `/orders` (đúng thiết kế `LoginPage:22`, không phải Dashboard) → sửa assertion; menu lọc quyền ĐÚNG (không có Người dùng/Cài đặt/Thống kê).

## Mục 4 — Hiệu năng (ApacheBench, 1 node dev, concurrency 20)
| Endpoint | req/s | p50 | p99 | lỗi |
|----------|------:|----:|----:|----:|
| `/health` | 3803 | 4ms | 16ms | 0 |
| `/suppliers` (tổng hợp công nợ) | 545 | 37ms | 62ms | 0 |
| `/reports/dashboard?range=12m` (nặng nhất) | 132 | 149ms | 209ms | 0 |

**0 request lỗi** ở mọi mức. Dashboard nặng nhất ~150ms — dư sức cho công cụ quản trị nội bộ.

## Tổng kết
Backend + DB + FE luồng chính đều ổn và đo được. Rủi ro còn lại thuần về **vận hành khi deploy** (secrets/CORS/TLS/backup ra ngoài VPS), đã ghi rõ ở mục 2.
