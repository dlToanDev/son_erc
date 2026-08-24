# Phase 9 — Triển khai (Docker / Deploy / Vận hành)

**Mục tiêu:** Đưa lên production ổn định.

## docker-compose production

```yaml
services:
  postgres:  image: postgres:16 · volume bền · cron pg_dump backup
  api:       NestJS · tự chạy prisma migrate deploy khi khởi động
  nginx:     serve React build (/) + proxy /api → api · TLS Let's Encrypt
```

## Công việc

- [x] `docker-compose.prod.yml` đầy đủ (postgres + api + nginx + backup, image tag theo `IMAGE_TAG`)
- [x] PostgreSQL: volume bền `pgdata_prod` + service backup `pg_dump` định kỳ (giữ N bản)
- [x] API: entrypoint tự chạy `prisma migrate deploy` khi khởi động
- [x] Nginx: một domain — `/` → React build, `/api` → NestJS, SPA fallback, gzip, security headers
- [x] TLS Let's Encrypt: `deploy/init-letsencrypt.sh` + `nginx-ssl.conf.template` (webroot ACME)
- [x] Biến môi trường qua `.env` (`.env.production.example` — secret bắt buộc, compose từ chối chạy nếu thiếu)
- [x] Seed admin production: `seed.js` biên dịch sẵn trong image (`node apps/api/prisma/seed.js`)
- [x] CI/CD: ci.yml thêm job build 2 image · deploy.yml (workflow_dispatch, SSH VPS, chọn tag rollback)
- [x] Tài liệu vận hành `DEPLOY.md` (khởi động, TLS, backup/restore, rollback, sự cố thường gặp)

## Definition of Done

- Truy cập qua 1 domain HTTPS ổn định.
- Migrate chạy tự động khi deploy.
- Backup định kỳ chạy, khôi phục được.
- Rollback được về phiên bản trước.

---

*— Hết lộ trình · DebtFlow Full-stack v1.0 —*
