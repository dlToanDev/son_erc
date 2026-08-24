import { test, expect } from '@playwright/test';

// Smoke FE: đăng nhập thật → điều hướng các màn chính → dữ liệu seed hiển thị.

test('đăng nhập admin → dashboard → nhà cung cấp → công nợ → audit log', async ({ page }) => {
  // 1. Trang login (thương hiệu Garden Chay)
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Garden Chay' })).toBeVisible();

  // 2. Đăng nhập admin (seed)
  await page.getByLabel('Email').fill('admin@debtflow.local');
  await page.getByLabel('Mật khẩu').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // 3. Admin về dashboard (LoginPage điều hướng ADMIN → '/')
  await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();

  // 4. Nhà cung cấp — thấy NCC seed
  await page.getByRole('link', { name: 'Nhà cung cấp' }).click();
  // getByRole('cell') nhắm đúng ô bảng desktop (tránh trùng span mobile ẩn → strict mode).
  await expect(page.getByRole('cell', { name: 'Công ty Thực phẩm Chay An Phú' })).toBeVisible();

  // 5. Công nợ — bảng hiển thị
  await page.getByRole('link', { name: /^Công nợ/ }).click();
  await expect(page.getByRole('heading', { name: /Công nợ phải trả/ })).toBeVisible();

  // 6. Audit log — có bản ghi LOGIN vừa tạo
  await page.getByRole('link', { name: 'Audit Log' }).click();
  await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  // getByRole('cell') nhắm ô bảng (tránh trùng <option> LOGIN trong dropdown lọc).
  await expect(page.getByRole('cell', { name: 'LOGIN' }).first()).toBeVisible();

  // 7. Đăng xuất → quay về login
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('đăng nhập sai mật khẩu → hiện lỗi, không vào được', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@debtflow.local');
  await page.getByLabel('Mật khẩu').fill('sai-mat-khau');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Email hoặc mật khẩu không đúng')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('staff chỉ thấy menu theo quyền (không có Người dùng/Cài đặt/Thống kê)', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('staff@debtflow.local');
  await page.getByLabel('Mật khẩu').fill('staff123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Staff được điều hướng sang trang Đặt hàng (LoginPage: STAFF → '/orders').
  await expect(page.getByRole('heading', { name: 'Quản lý đặt hàng' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nhà cung cấp' })).toBeVisible();
  // Staff seed không có users.view / settings.edit / reports.view
  await expect(page.getByRole('link', { name: 'Người dùng' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Cài đặt' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Thống kê' })).toHaveCount(0);
});
