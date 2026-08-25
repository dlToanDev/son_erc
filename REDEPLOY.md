# Hướng dẫn Deploy lại lên VPS Google Cloud

> Dùng khi bạn đã sửa code ở máy (UI, logo, seed…) và muốn cập nhật lên server đang chạy.
> Tài liệu vận hành đầy đủ (TLS, backup, rollback…) xem `DEPLOY.md`.

**Thông tin server (điền lại nếu khác):**

| Mục | Giá trị |
|---|---|
| IP / URL | `http://136.85.82.93` |
| Thư mục dự án trên VPS | `/opt/debtflow` |
| File compose | `docker-compose.prod.yml` |
| Repo | `https://github.com/dlToanDev/son_erc.git` (nhánh `main`) |

Cơ chế: VPS **kéo code mới từ GitHub** rồi build lại Docker. Vì vậy **bước bắt buộc đầu tiên là đẩy code của bạn lên GitHub**.

---

## Bước 0 — Đẩy code từ máy bạn lên GitHub (BẮT BUỘC)

Chạy ở máy của bạn, trong thư mục dự án:

```bash
cd /home/toan/Dltoan/Code/job/erc-son

git status                    # xem các file đã sửa
git add -A
git commit -m "Cập nhật: seed 9 NCC, bảng responsive mobile, logo, sửa NCC dưới mặt hàng"
git push origin main
```

> Nếu `git push` đòi đăng nhập: dùng Personal Access Token của GitHub (không phải mật khẩu).

---

## Cách A — Deploy tự động qua GitHub Actions ⭐ (dễ nhất, không cần SSH)

Dự án đã có sẵn workflow deploy. Sau khi đã `git push`:

1. Mở GitHub → repo `son_erc` → tab **Actions**.
2. Chọn workflow **Deploy** (menu bên trái) → nút **Run workflow**.
3. Nhánh: `main` → để `image_tag` = `latest` → **Run workflow**.
4. Chờ ~2–5 phút cho tới khi dấu ✓ xanh. Xong.

> Workflow tự SSH vào VPS, `git checkout` đúng commit vừa push, rồi `docker compose up -d --build`.
> Cần đã cấu hình Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (Settings → Secrets → Actions).

---

## Cách B — Deploy thủ công bằng SSH vào VPS

### B1. SSH vào VPS

Cách 1 — dùng gcloud CLI (thay tên máy & zone của bạn):

```bash
gcloud compute ssh TEN_MAY_AO --zone=asia-southeast1-a
```

Cách 2 — SSH thường:

```bash
ssh USER@136.85.82.93
```

### B2. Kéo code mới & build lại

```bash
cd /opt/debtflow

git pull origin main

# Build lại & khởi động (web + api + nginx). Migration DB TỰ CHẠY khi api khởi động.
docker compose -f docker-compose.prod.yml up -d --build

# Xem 4 service đang chạy ổn:
docker compose -f docker-compose.prod.yml ps
```

Chỉ vậy là **giao diện mới + logo** đã lên. Vì frontend được build vào image `nginx/web` nên
mỗi lần `--build` là bản web mới thay thế bản cũ.

---

## ⚠️ QUAN TRỌNG — Về dữ liệu mẫu (seed)

Bạn vừa sửa `apps/api/prisma/seed.ts` (9 NCC + sinh lại giao dịch). Lưu ý:

- **Chỉ deploy code (Cách A hoặc B) KHÔNG tự chạy seed** → dữ liệu hiện có trên server **giữ nguyên**.
  Giao diện, logo, cột NCC… vẫn cập nhật bình thường. **Đây là trường hợp an toàn, nên dùng.**
- Seed **XOÁ TOÀN BỘ dữ liệu** rồi tạo lại từ đầu (`reset()`). Chỉ chạy khi bạn **thật sự muốn thay
  dữ liệu server bằng 9 NCC mẫu mới** và chấp nhận mất dữ liệu cũ.

Nếu vẫn muốn nạp lại seed mới (đã hiểu là mất dữ liệu):

```bash
cd /opt/debtflow

# 1) SAO LƯU TRƯỚC cho chắc:
docker compose -f docker-compose.prod.yml exec backup sh /backup.sh once

# 2) Chạy seed (image production dùng seed.js đã build sẵn, KHÔNG phải ts-node):
docker compose -f docker-compose.prod.yml exec api node apps/api/prisma/seed.js
```

> Nếu báo không thấy `seed.js`, kiểm tra đường dẫn: `docker compose -f docker-compose.prod.yml exec api ls apps/api/prisma`.

---

## Kiểm tra sau khi deploy

```bash
# API đã sẵn sàng (thấy "listening" / không lỗi migrate):
docker compose -f docker-compose.prod.yml logs --tail=50 api
```

Rồi mở trình duyệt: `http://136.85.82.93` — nhấn **Ctrl + Shift + R** để xoá cache
(bắt buộc, nếu không sẽ thấy logo/giao diện cũ do trình duyệt lưu tạm).

---

## Xử lý sự cố nhanh

| Triệu chứng | Cách xử lý |
|---|---|
| Vẫn thấy logo/giao diện cũ | Ctrl+Shift+R (hard refresh) hoặc mở tab ẩn danh; kiểm tra `docker compose ... ps` xem web đã build lại chưa |
| Trang trắng / 502 | `docker compose -f docker-compose.prod.yml logs api` — thường do DB chưa healthy hoặc migrate lỗi |
| `git pull` báo xung đột | Trên VPS chỉ nên có code từ GitHub. Nếu ai đó sửa tay trên VPS: `git stash` rồi `git pull` |
| Hết dung lượng ổ khi build | Dọn image cũ: `docker image prune -a` |
| Login lỗi 401 hàng loạt | JWT secret trong `.env` bị đổi → mọi token cũ hết hiệu lực (đăng nhập lại là được) |

---

## Tóm tắt siêu ngắn (lần sau chỉ cần nhớ bấy nhiêu)

```bash
# Máy bạn:
git add -A && git commit -m "cập nhật" && git push origin main

# Rồi 1 trong 2:
#  - GitHub → Actions → Deploy → Run workflow      (tự động)
#  - SSH vào VPS:
ssh USER@136.85.82.93
cd /opt/debtflow && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Không đụng tới seed = dữ liệu an toàn. Xong thì Ctrl+Shift+R để xem bản mới.
