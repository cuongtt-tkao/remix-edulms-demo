# Quy Tắc Thiết Kế Giao Diện Toàn Dự Án — Hành Thực Lục

## Nguyên tắc cốt lõi: Hạn chế tối đa việc cuộn trang (Minimal-Scroll & Compact Viewport Budget)

Mọi tính năng mới và phần nâng cấp giao diện trong dự án **bắt buộc** tuân thủ các quy tắc dưới đây để đảm bảo thao tác nhanh, gọn, trực quan trên cả **điện thoại (360px–414px)** và **máy tính**:

### 1. Giới hạn chiều cao màn hình đầu tiên (Single-Screen Action Budget)
- Trên màn hình **Mobile** (`< 640px`), vùng nội dung chính của các màn hình nhập liệu nhanh (*Lịch làm việc, Báo cáo hằng ngày*) phải gói gọn trong **~540px–650px** để người dùng nhìn thấy đủ toàn bộ bảng nhập và nút **Lưu** mà **không cần hoặc hạn chế tối đa việc cuộn trang**.
- Nếu một trang có từ **2 khối nội dung lớn trở lên** trên mobile (ví dụ: *Lịch 3 buổi* và *Lịch WS Tuần*), tách thành **tab chuyển nhanh ngay đầu khối** (`grid-cols-2`, chỉ áp dụng trên `< md` bằng `md:hidden`), còn trên desktop hiển thị song song hoặc nối tiếp gọn gàng.

### 2. Dữ liệu lặp theo ngày / chỉ số → Dùng Bảng / Lưới ngang thay cho Thẻ xếp dọc
- **Không** lặp lại thẻ card xếp dọc với nhiều nhãn phụ trên mobile (ví dụ: không render 7 card dọc cao 100px cho 7 ngày).
- Dùng **bảng ma trận / lưới ngang siêu gọn**: tiêu đề cột đặt 1 lần ở đầu bảng, mỗi hàng `~38px–44px` với ô nhập `h-9` (đủ rộng & dễ chạm bằng ngón tay).

### 3. Mật độ khoảng cách chuẩn (Compact Spacing Scale)
- **Container trang chính (`<main>`)**: `px-2.5 py-2.5 sm:px-6 sm:py-4` (không dùng `py-6` hoặc `p-6/p-8` trên mobile).
- **Khoảng cách giữa các khối**: `space-y-2.5 sm:space-y-4` (tránh `space-y-6` / `space-y-8` gây khoảng trống chết).
- **Trong thẻ Card**: `p-3 sm:p-4 rounded-2xl` (dùng `rounded-2xl` gọn thay vì `rounded-3xl` + `p-6`).

### 4. Tab, KPI và Bộ lọc luôn ưu tiên hàng ngang
- **Sub-tabs**: Luôn dùng `grid-cols-2` / `grid-cols-3` / `grid-cols-4` nằm ngang trên mọi kích thước màn hình (rút gọn nhãn ngắn gọn trên mobile thay vì xếp dọc `grid-cols-1`).
- **Thống kê KPI đầu trang**: Tối đa **1 hàng ngang** (`grid-cols-4` hoặc `grid-cols-2 sm:grid-cols-4` với `p-2 sm:p-3`).
- **Bộ lọc / Tìm kiếm**: Gộp tối đa **2 hàng** (1 hàng tìm kiếm + 1 hàng chứa 2–3 select ngang `grid-cols-2` / `grid-cols-3`).
- **Ẩn mô tả hướng dẫn thừa trên Mobile**: Các dòng chú thích dài dưới tiêu đề chỉ hiện từ màn hình vừa trở lên (`hidden sm:block`) hoặc viết ngắn gọn dưới 1 dòng.

### 5. Vẫn đảm bảo chạm chuẩn & đọc rõ
- Ô nhập liệu và nút bấm chính vẫn giữ chiều cao tối thiểu **`h-9` (`36px`) đến `h-10` (`40px`)** để tránh bấm nhầm.
- Số liệu trong bảng và KPI luôn dùng `tabular-nums` để căn thẳng hàng.
