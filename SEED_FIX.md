# DebtFlow — Chẩn đoán & tạo tài khoản admin (seed)

> Chạy tất cả lệnh dưới đây **trên VPS**, trong thư mục `/opt/debtflow`.
> Nếu chưa ở đó: `cd /opt/debtflow`

---

## Bước 1 — Chẩn đoán container `api`

Chạy lệnh này, copy toàn bộ output gửi lại:

```
docker compose -f docker-compose.prod.yml exec api sh -lc 'pwd; echo ---LS---; ls; echo ---PRISMA---; ls apps/api/prisma; echo ---PKG---; grep -A3 prisma package.json; echo ---TSNODE---; which ts-node || echo NO_TSNODE; echo ---BINS---; ls node_modules/.bin | grep -iE "ts-node|prisma"; echo ---SEEDJS---; find . -name "seed*.js" -not -path "*/node_modules/*"; echo ---DBURL---; printenv DATABASE_URL'
```

Nếu khó copy cả khối, chạy từng lệnh:

```
docker compose -f docker-compose.prod.yml exec api pwd
```
```
docker compose -f docker-compose.prod.yml exec api ls
```
```
docker compose -f docker-compose.prod.yml exec api ls apps/api/prisma
```
```
docker compose -f docker-compose.prod.yml exec api sh -c "which ts-node || echo NO_TSNODE"
```
```
docker compose -f docker-compose.prod.yml exec api sh -c "printenv DATABASE_URL"
```

---

## Bước 2 — Thử chạy seed (xem có báo lỗi gì không)

```
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

- Nếu in ra `✅ Seed dữ liệu mẫu thành công ...` → xong, sang Bước 4.
- Nếu **không in gì** hoặc báo lỗi → làm Bước 3.

---

## Bước 3 — Kiểm tra đã có user trong DB chưa

```
docker compose -f docker-compose.prod.yml exec postgres psql -U debtflow -d debtflow -c "SELECT email, role FROM \"User\";"
```

- Nếu bảng rỗng (0 rows) → admin chưa được tạo, cần seed lại (Bước 2) hoặc cách thủ công bên dưới.
- Nếu có `admin@debtflow.local` → tài khoản đã có, thử đăng nhập lại.

---

## Bước 4 — Đăng nhập

- URL: `http://136.85.82.93`  (nhấn **Ctrl+Shift+R** để xoá cache)
- Email: `admin@debtflow.local`
- Mật khẩu: `admin123`

Tài khoản nhân viên (nếu seed đầy đủ): `staff1@debtflow.local` / `staff123`

---

## Ghi chú

- Image production có thể **không có `ts-node`** → `prisma db seed` chạy im lặng, không tạo user.
- Sau khi có kết quả Bước 1, mình sẽ chọn cách seed đúng (chạy seed đã build, hoặc chèn admin trực tiếp bằng SQL).
