# DebtFlow — Hướng dẫn cài đặt & chạy dự án

> **DebtFlow** — Hệ thống quản lý mua hàng & công nợ nhà cung cấp đa cơ sở.  
> Stack: NestJS · Prisma · PostgreSQL 16 · React 18 · Vite · TypeScript

---

## Yêu cầu hệ thống

| Công cụ       | Phiên bản tối thiểu |
|---------------|---------------------|
| Node.js       | 20+                 |
| npm           | 10+ (đi kèm Node)   |
| Docker        | 24+                 |
| Docker Compose| v2 (plugin)         |

---

## Cách 1 — Chạy bằng Docker (Khuyến nghị)

Cách nhanh nhất, không cần cài PostgreSQL thủ công.

### Bước 1: Tạo file `.env`

```bash
cp .env.example .env
```

Mở `.env` và chỉnh nếu cần (mặc định là đủ để dev):

```env
POSTGRES_USER=debtflow
POSTGRES_PASSWORD=debtflow_dev_pw
POSTGRES_DB=debtflow
DATABASE_URL=postgresql://debtflow:debtflow_dev_pw@postgres:5432/debtflow?schema=public

JWT_ACCESS_SECRET=change_me_access_secret
JWT_REFRESH_SECRET=change_me_refresh_secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

API_PORT=3000
WEB_PORT=5173
CORS_ORIGIN=http://localhost:5173
API_PROXY_TARGET=http://api:3000
```

### Bước 2: Khởi động toàn bộ stack

```bash
docker compose up --build
```

Lần đầu build sẽ mất vài phút. Sau đó:

- **API** chạy tại: <http://localhost:3000/api/v1>
- **Web** chạy tại: <http://localhost:5173>

### Bước 3: Chạy migration & seed dữ liệu mẫu

Mở terminal mới (stack vẫn chạy ở tab kia):

```bash
# Chạy migration database
docker compose exec api npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

# Seed dữ liệu ban đầu (admin + staff mẫu + danh mục)
docker compose exec api npm run prisma:seed --workspace apps/api
```

### Bước 4: Đăng nhập

Mở <http://localhost:5173> và đăng nhập bằng:

| Vai trò | Email                  | Mật khẩu   |
|---------|------------------------|------------|
| Admin   | <admin@debtflow.local>   | admin123   |
| Staff   | <staff@debtflow.local>   | staff123   |

---

## Cách 2 — Chạy thủ công (Local)

Dùng khi muốn debug hoặc chạy từng service riêng lẻ.

### Bước 1: Cài dependencies

```bash
npm install
```

### Bước 2: Khởi động PostgreSQL

Bạn cần một PostgreSQL 16 đang chạy. Cách nhanh nhất dùng Docker chỉ cho DB:

```bash
docker compose up postgres -d
```

Hoặc nếu đã có PostgreSQL local, tạo database:

```sql
CREATE USER debtflow WITH PASSWORD 'debtflow_dev_pw';
CREATE DATABASE debtflow OWNER debtflow;
```

### Bước 3: Tạo file `.env` + symlink cho Prisma

```bash
cp .env.example .env
```

Chỉnh `DATABASE_URL` — thay `@postgres` bằng `@localhost` (Prisma chạy local không dùng hostname Docker):

```env
DATABASE_URL=postgresql://debtflow:debtflow_dev_pw@localhost:5432/debtflow?schema=public
```

Tạo symlink để Prisma tìm được `.env` (Prisma đọc từ thư mục chứa `schema.prisma`):

```bash
ln -s ../../.env apps/api/.env
```

### Bước 4: Generate Prisma client + chạy migration

```bash
cd apps/api
npx prisma generate
npm run prisma:seed
cd ../..
```

### Bước 5: Chạy dự án (Cả FE & BE)

Khởi động đồng thời cả Backend (NestJS) và Frontend (Vite + React) bằng **1 lệnh duy nhất**:

```bash
npm run dev
```

- **API (NestJS)** lắng nghe tại: <http://localhost:3000/api/v1>
- **Web (React)** lắng nghe tại: <http://localhost:5173>

*(Nếu muốn chạy riêng từng service, bạn vẫn có thể dùng `npm run dev:api` hoặc `npm run dev:web`)*

---

## Cấu trúc dự án

```
erc-son/
├── apps/
│   ├── api/           # Backend — NestJS + Prisma
│   │   ├── prisma/    # Schema, migrations, seed
│   │   └── src/       # Modules: auth, orders, receipts, inventory, ...
│   └── web/           # Frontend — React 18 + Vite + TypeScript
│       └── src/       # Pages, components, hooks, store
├── packages/
│   └── shared/        # Types & enums dùng chung FE + BE
├── docker-compose.yml       # Dev stack (postgres + api + web)
├── docker-compose.prod.yml  # Production stack (+ nginx + TLS)
└── .env.example
```

---

## Các lệnh hay dùng

### Quản lý Docker

```bash
# Khởi động stack (chạy ngầm)
docker compose up -d

# Xem log
docker compose logs -f

# Xem log từng service
docker compose logs -f api
docker compose logs -f web

# Dừng stack
docker compose down

# Dừng và xoá dữ liệu DB (reset toàn bộ)
docker compose down -v
```

### Prisma

```bash
# Tạo migration mới khi sửa schema
docker compose exec api npx prisma migrate dev --name <ten_migration> --schema=apps/api/prisma/schema.prisma

# Mở Prisma Studio (GUI duyệt DB)
docker compose exec api npx prisma studio --schema=apps/api/prisma/schema.prisma

# Reset DB và seed lại
docker compose exec api npx prisma migrate reset --schema=apps/api/prisma/schema.prisma
```

### Kiểm thử

```bash
# Unit tests (backend)
npm run test --workspace apps/api

# E2E tests (backend — cần stack đang chạy)
docker compose exec api npm run test:e2e

# Smoke tests (frontend Playwright — cần stack đang chạy)
npm run test:smoke --workspace apps/web
```

---

## Biến môi trường quan trọng

| Biến                  | Mô tả                              | Mặc định                      |
|-----------------------|------------------------------------|-------------------------------|
| `DATABASE_URL`        | Connection string PostgreSQL       | `postgresql://...@postgres/debtflow` |
| `JWT_ACCESS_SECRET`   | Secret JWT access token            | **Đổi khi deploy!**           |
| `JWT_REFRESH_SECRET`  | Secret JWT refresh token           | **Đổi khi deploy!**           |
| `JWT_ACCESS_TTL`      | Thời hạn access token              | `15m`                         |
| `JWT_REFRESH_TTL`     | Thời hạn refresh token             | `7d`                          |
| `API_PORT`            | Port API                           | `3000`                        |
| `WEB_PORT`            | Port Web                           | `5173`                        |
| `CORS_ORIGIN`         | Origin được phép gọi API           | `http://localhost:5173`       |

---

## Xử lý lỗi thường gặp

**Lỗi: `Environment variable not found: DATABASE_URL`**

Prisma tìm `.env` tương đối với `schema.prisma` nằm ở `apps/api/`. Cần tạo symlink:

```bash
ln -s ../../.env apps/api/.env
```

Đồng thời đảm bảo `DATABASE_URL` dùng `@localhost` (không phải `@postgres`) khi chạy local.

**Lỗi: `EADDRINUSE` — port đang bị chiếm**

```bash
# Kiểm tra process đang dùng port 3000 hoặc 5173
lsof -i :3000
lsof -i :5173
```

**Lỗi: `Can't reach database server`**

- Kiểm tra container postgres đã healthy chưa: `docker compose ps`
- Xem log postgres: `docker compose logs postgres`

**Lỗi: `Prisma Client not generated`**

```bash
docker compose exec api npx prisma generate --schema=apps/api/prisma/schema.prisma
```

**Lỗi migration khi đổi schema**

```bash
# Reset toàn bộ DB (mất dữ liệu!) rồi chạy lại
docker compose exec api npx prisma migrate reset --schema=apps/api/prisma/schema.prisma
```
