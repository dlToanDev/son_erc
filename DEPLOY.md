# DebtFlow — Tài liệu vận hành (Production)

## Kiến trúc

```
Internet → Nginx (:80/:443, 1 domain)
             ├── /        → React build tĩnh (trong image debtflow-web)
             └── /api     → API NestJS (debtflow-api:3000)
                              └── PostgreSQL 16 (volume pgdata_prod)
Backup: service `backup` chạy pg_dump định kỳ → volume `backups`
```

## 1. Chuẩn bị VPS (lần đầu)

```bash
# Cài docker + compose plugin, rồi:
sudo mkdir -p /opt/debtflow && cd /opt/debtflow
git clone <repo-url> .
cp .env.production.example .env
nano .env   # điền POSTGRES_PASSWORD, JWT secrets (openssl rand -base64 48), CORS_ORIGIN
```

## 2. Khởi động

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps          # 4 service healthy/running
docker compose -f docker-compose.prod.yml logs api    # thấy "prisma migrate deploy" rồi "listening"
```

Migration **tự chạy** mỗi lần container `api` khởi động (entrypoint) — deploy phiên bản mới là schema tự cập nhật.

## 3. Seed admin đầu tiên

```bash
# Đặt SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD trong .env trước khi chạy.
# CẢNH BÁO: seed RESET toàn bộ dữ liệu — chỉ chạy lần đầu trên DB trống!
docker compose -f docker-compose.prod.yml exec api node apps/api/prisma/seed.js
```

> Image production chạy `seed.js` đã biên dịch sẵn (ts-node chỉ có ở môi trường dev).

## 4. TLS (Let's Encrypt)

```bash
# DNS domain đã trỏ về VPS, stack đang chạy cổng 80:
DOMAIN=debtflow.example.com EMAIL=ban@email.com sh deploy/init-letsencrypt.sh
```

Script sẽ: xin chứng chỉ (webroot) → sinh `nginx/nginx.conf` từ template SSL → rebuild nginx.
Gia hạn: thêm cron mỗi tháng chạy `certbot renew` + `restart nginx` (lệnh in ra cuối script).

## 5. Backup & Restore

- **Tự động**: service `backup` dump **mỗi ngày lúc `BACKUP_AT`** (mặc định 23:00 giờ VN, đặt `TZ=Asia/Ho_Chi_Minh`), giữ `BACKUP_KEEP` bản (mặc định 14) trong volume `backups`.
- **Khôi phục ngay trong app** (Admin): trang **Cài đặt → Vùng nguy hiểm → "Khôi phục dữ liệu về bản gần nhất"** — gõ `KHOI PHUC` để xác nhận. Ghi đè DB về bản backup mới nhất (thường là 23h tối trước); mọi dữ liệu tạo sau mốc đó sẽ mất. Ghi AuditLog `RESTORE_DATABASE`.
- **Chạy tay 1 bản ngay**:

```bash
docker compose -f docker-compose.prod.yml exec backup sh /backup.sh once
docker compose -f docker-compose.prod.yml exec backup ls -lh /backups
```

- **Lấy file ra ngoài VPS** (thủ công):

```bash
docker compose -f docker-compose.prod.yml cp backup:/backups ./backups-local
```

### Đẩy tự động lên Google Drive (offsite — đề phòng VPS chết) ⭐

Backup local nằm cùng ổ đĩa VPS → **VPS chết là mất cả backup**. Bật đẩy lên Drive để an toàn thật.
Cấu hình **1 lần**:

```bash
# 1. Cài rclone ở máy CÓ trình duyệt (máy bạn), tạo remote tên "gdrive" cho Google Drive:
rclone config
#   → n (new) → tên: gdrive → chọn "drive" (Google Drive) → làm theo hướng dẫn đăng nhập Google.
#   (VPS không có trình duyệt: chọn "use auto config? No", chạy `rclone authorize "drive"`
#    ở máy bạn rồi dán token vào.)

# 2. Chép khối [gdrive] trong file config (`rclone config file` để xem đường dẫn) vào:
#    deploy/rclone.conf   trên VPS   (cp deploy/rclone.conf.example deploy/rclone.conf rồi dán vào)

# 3. Trong .env đặt thư mục đích trên Drive:
#    RCLONE_REMOTE=gdrive:debtflow-backups

# 4. Dựng lại service backup:
docker compose -f docker-compose.prod.yml up -d --build backup
```

Sau đó **mỗi 23h**, sau khi dump xong nó tự `rclone copy` file lên Drive và dọn bản cũ hơn
`RCLONE_KEEP_DAYS` ngày (mặc định 30). Kiểm tra ngay:

```bash
docker compose -f docker-compose.prod.yml exec backup sh /backup.sh once   # tạo + đẩy 1 bản luôn
docker compose -f docker-compose.prod.yml exec backup rclone ls gdrive:debtflow-backups
```

> Lỗi mạng khi đẩy Drive **không** làm hỏng backup local — bản vẫn nằm trong volume, lần sau đẩy lại.
> Nếu VPS chết: tải file `.sql.gz` mới nhất từ Google Drive về, rồi dùng phần **Restore** dưới đây trên máy/VPS mới.

- **Restore** (DB hỏng / chuyển máy):

```bash
# Dừng api để không ghi thêm:
docker compose -f docker-compose.prod.yml stop api
# Nạp lại từ bản dump (thay tên file):
gunzip -c backups-local/debtflow-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U debtflow -d debtflow
docker compose -f docker-compose.prod.yml start api
```

> Restore vào DB đang có dữ liệu sẽ lỗi trùng — tạo DB trống trước
> (`dropdb`/`createdb` trong container postgres) rồi mới nạp.

## 6. Cập nhật phiên bản

```bash
cd /opt/debtflow
git pull
docker compose -f docker-compose.prod.yml up -d --build   # migrate tự chạy
```

Hoặc qua GitHub Actions: **Actions → Deploy → Run workflow** (cần secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`).

## 7. Rollback

Image được tag theo `IMAGE_TAG` (mặc định `latest`). Quy trình khuyến nghị — tag mỗi bản phát hành:

```bash
# Khi phát hành:
IMAGE_TAG=v1.2.0 docker compose -f docker-compose.prod.yml build
IMAGE_TAG=v1.2.0 docker compose -f docker-compose.prod.yml up -d

# Rollback về bản trước (image còn trên máy):
IMAGE_TAG=v1.1.0 docker compose -f docker-compose.prod.yml up -d --no-build
```

Lưu ý: migration Prisma là **forward-only** — rollback code vẫn chạy được trên schema mới
(thay đổi cột kiểu additive). Nếu migration phá vỡ tương thích, restore DB từ backup trước.

## 8. Sự cố thường gặp

| Triệu chứng | Kiểm tra |
|---|---|
| 502 từ nginx | `logs api` — API chưa lên (thường do migrate lỗi / DB chưa healthy) |
| Login 401 hàng loạt sau deploy | JWT secret trong `.env` bị đổi → mọi token cũ mất hiệu lực (đúng thiết kế) |
| CORS lỗi trên trình duyệt | `CORS_ORIGIN` chưa khớp domain thật (kèm https://) |
| Hết dung lượng ổ | Xoá image cũ: `docker image prune -a` · giảm `BACKUP_KEEP` |

## Tài khoản & bảo mật

- Mọi secret nằm trong `.env` trên VPS — KHÔNG commit.
- Đổi mật khẩu admin ngay sau seed (trang Người dùng).
- Firewall VPS: chỉ mở 22/80/443.
