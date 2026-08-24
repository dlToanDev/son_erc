# PROMPT CHỈNH SỬA & NÂNG CẤP GIAO DIỆN DEBTFLOW

Bạn hãy chỉnh sửa lại toàn bộ giao diện của dự án Frontend React (`apps/web`) của ứng dụng **DebtFlow** (Hệ thống quản lý mua hàng & công nợ nhà cung cấp). Yêu cầu cải tiến tổng thể để giao diện trở nên chuyên nghiệp, hiện đại, thoáng đãng, và khắc phục triệt để các lỗi tràn chữ, lệch nút hoặc vỡ layout trên các loại màn hình khác nhau.

Dưới đây là các yêu cầu chi tiết về mặt kỹ thuật và thiết kế:

---

### 1. Hệ thống màu sắc (Color Palette)
Cập nhật lại hệ thống CSS Variables trong `src/styles/global.css` sử dụng các tông màu chuyên nghiệp sau:
- **Xanh dương (Chủ đạo/Primary)**: `#1e40af` (xanh dương đậm) và `#2563eb` (xanh dương sáng) dùng cho nút hành động chính, sidebar hoạt động, liên kết quan trọng.
- **Trắng/Xám nhạt (Nền/Background)**: Nền ứng dụng `#f8fafc` hoặc `#f1f5f9`. Nền các thẻ panel/card là màu trắng tinh `#ffffff` để tạo chiều sâu.
- **Đen/Xám đậm (Chữ/Text)**: `#0f172a` hoặc `#1e293b` cho tiêu đề và nội dung chính để dễ đọc.
- **Đỏ (Cảnh báo/Danger/Nợ quá hạn)**: `#dc2626` dùng cho badge quá hạn, thông báo lỗi nguy hiểm, các khoản nợ cần chú ý gấp.
- **Xanh lá cây (Thành công/Success/Đã thanh toán)**: `#16a34a` dùng cho trạng thái hoàn thành, nút xác nhận thành công, chỉ số tăng trưởng tích cực.

---

### 2. Layout, Khung sườn & Khả năng hiển thị Responsive
- **Bố cục thoáng đãng (Spacious & Clean)**: Tăng khoảng cách đệm (padding/margin) hợp lý giữa các khối dữ liệu. Sử dụng `gap: 1.5rem` hoặc `gap: 2rem` cho các grid để tạo khoảng thở cho mắt.
- **Tránh chồng chéo (No Overlapping)**:
  - Tất cả các nút bấm (button), menu phải được thiết lập kích thước tối thiểu rõ ràng, không bị co kéo hay đè lên các nhãn văn bản.
  - Văn bản dài trong bảng hoặc card phải được xử lý bằng `text-overflow: ellipsis` kết hợp thuộc tính hiển thị tooltip đầy đủ, tuyệt đối không được che mất chữ hay làm vỡ bố cục.
- **Thiết kế Responsive hoàn chỉnh**:
  - Giao diện Sidebar ở màn hình lớn (`min-width: 1024px`) dạng dọc cố định.
  - Ở màn hình nhỏ (Tablet/Mobile), Sidebar chuyển thành menu rút gọn hoặc Hamburger menu ẩn hiện, đảm bảo nội dung chính của trang hiển thị toàn màn hình, không bị bóp nghẹt.
  - Sử dụng CSS Grid/Flexbox với cơ chế tự động xuống dòng (`flex-wrap: wrap`, `grid-template-columns: repeat(auto-fit, minmax(...))`) cho toàn bộ trang và thanh bộ lọc (Filter bar).

---

### 3. Biểu đồ báo cáo và Thống kê trực quan (SVG Charts)
Do dự án không dùng thư viện biểu đồ bên ngoài, hãy tối ưu hóa các thành phần SVG hiện tại và bổ sung:
- **Biểu đồ Cột (Bar/Column Chart)**:
  - Nâng cấp `src/components/BarChart.tsx` hiển thị cột SVG với màu xanh dương (`#2563eb`), bo góc nhẹ cột (`rx={4}`).
  - Bổ sung hiệu ứng hover đổi màu cột nhạt hơn, hiển thị tooltip dạng popup chứa số liệu tiền tệ chi tiết (`formatMoney`).
  - Thêm trục tọa độ Y với các mốc giá trị tượng trưng giúp người dùng ước lượng trực quan.
- **Biểu đồ Tròn SVG (Pie/Donut Chart)**:
  - Tạo mới một component `PieChart.tsx` dựng bằng SVG thuần (sử dụng thuộc tính `stroke-dasharray` hoặc đường dẫn `<path>` tính góc) để hiển thị cơ cấu công nợ của các nhà cung cấp chính hoặc theo cơ sở.
  - Phân tách các phần bằng các màu sắc khác nhau trong bảng màu đã định nghĩa. Có chú thích (Legend) rõ ràng bên cạnh.

---

### 4. Bảng dữ liệu định dạng Excel (Excel-like Grid)
Nâng cấp giao diện hiển thị bảng trong `src/components/DataTable.tsx` và các trang danh sách:
- **Bố cục dạng lưới**: Thêm đường viền mỏng (`border: 1px solid #e2e8f0`) giữa các hàng và cột để tạo cảm giác khuôn bảng Excel ngăn nắp.
- **Phân loại dữ liệu**:
  - Căn lề trái cho tên nhà cung cấp, tên sản phẩm.
  - Căn lề phải cho cột số lượng, đơn giá, thành tiền, dư nợ.
  - Căn lề giữa cho mã phiếu, ngày tháng và trạng thái.
- **Tiêu đề nổi bật**: Hàng tiêu đề bảng (table header) sử dụng màu nền xám nhẹ `#f1f5f9` với chữ viết hoa, in đậm nhẹ để phân biệt rõ với dữ liệu bên dưới.
- **Dòng tổng cộng (Total Row)**: Ở cuối bảng (ví dụ: Tổng cộng công nợ, tổng tiền phiếu nhập), hiển thị một hàng tổng kết in đậm, nền xám/xanh dương rất nhạt để chốt số liệu rõ ràng.

---

### 5. Form tạo/Xem chi tiết phiếu nhập (Purchase Receipt Detail)
Tối ưu hóa trang `src/pages/ReceiptDetailPage.tsx` và form nhập liệu:
- **Thông tin bao quát chi tiết**:
  - Chia thông tin chung (Nhà cung cấp, cơ sở nhập, ngày nhập, hạn thanh toán, ghi chú...) thành dạng Grid 2 hoặc 3 cột, hiển thị rõ ràng như một mẫu hóa đơn thực tế.
  - Trạng thái phiếu (Nháp/Đã xác nhận) hiển thị bằng badge bo góc nổi bật (Xanh lá cây cho Đã xác nhận, Vàng/Muted cho Nháp).
- **Phần danh sách mặt hàng (Line Items)**:
  - Bảng mặt hàng bên trong phiếu nhập phải được thiết kế chi tiết bao gồm: Tên sản phẩm, Đơn vị tính, Số lượng, Đơn giá, Thành tiền của từng dòng.
  - Phía dưới bảng hiển thị phần tổng kết tài chính rõ ràng: Tạm tính -> Chiết khấu (Giảm giá) -> Thuế (VAT) -> **Tổng cộng cuối cùng (Grand Total)**.
  - Nếu phiếu ở trạng thái "Nháp", nút "Xác nhận và Sinh công nợ" phải được hiển thị to rõ ở góc trên bên phải, có trạng thái `loading` và tự động vô hiệu hóa sau khi nhấn để tránh gửi trùng lặp.
