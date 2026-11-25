# HeyDay với MySQL/MariaDB và phpMyAdmin

phpMyAdmin là giao diện quản lý. Laravel kết nối trực tiếp tới MySQL/MariaDB bằng PDO MySQL.

## Tạo cơ sở dữ liệu

1. Khởi động MySQL/MariaDB trong XAMPP, Laragon hoặc máy chủ đang sử dụng.
2. Mở phpMyAdmin, tạo database tên `heyday` với collation `utf8mb4_unicode_ci`. Có thể nhập tệp `database/mysql-create.sql` trong tab Import.
3. Tạo tài khoản ứng dụng có quyền trên database `heyday`. Điền host, cổng, username và password tương ứng trong phần DB của `.env`.

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=heyday
DB_USERNAME=heyday_app
DB_PASSWORD=
```

Điền mật khẩu thật vào `.env`. Tệp `.env.mysql.example` dành cho cài mới. Với dự án đã có dữ liệu, chỉnh phần DB trong `.env` hiện tại để giữ APP_KEY và cấu hình Reverb đang dùng.

## Tạo bảng

```powershell
php artisan config:clear
php artisan migrate
npm.cmd ci
npm.cmd run build
```

Sau migration, dùng Refresh trong phpMyAdmin để xem các bảng. SQLite cũ vẫn còn ở `database/database.sqlite`. Chuyển cấu hình kết nối sang MySQL chỉ tạo cấu trúc bảng trên MySQL; dữ liệu SQLite cũ cần được chuyển riêng nếu muốn tiếp tục sử dụng.

Dùng `php artisan db:seed` cho bản local mới, có bảng người dùng trống. Tài khoản mẫu được tạo bởi DemoSeeder. Production sử dụng tài khoản đăng ký thật và dữ liệu thực tế.

## Khởi tạo quản trị viên

Đăng ký một tài khoản bằng giao diện, rồi dùng tên đăng nhập của tài khoản đó trong lệnh sau.

```powershell
php artisan heyday:admin ten_dang_nhap --reason="Khởi tạo quản trị hệ thống"
```

Đăng nhập lại, mở **Tùy chỉnh giao diện → Quản trị HeyDay**. Bảng quản trị có số liệu thực tế, tìm kiếm tài khoản, khóa hoặc mở khóa, cấp hoặc thu hồi quyền, xử lý báo cáo và nhật ký thao tác. Hệ thống yêu cầu lý do khi thay đổi quyền/trạng thái hoặc xử lý báo cáo. Quản trị viên cần người quản trị khác thay đổi trạng thái hoặc quyền của chính mình.

Người dùng gửi báo cáo bằng biểu tượng lá cờ cạnh tin nhắn của người khác. Quản trị viên chỉ mở được ảnh qua mục báo cáo có liên quan. Khi gỡ tin, nội dung và tệp đính kèm được thu hồi, còn báo cáo và nhật ký được lưu để đối chiếu.

## Vận hành

- Chạy Laravel và Reverb theo README.
- Trước khi cập nhật, xuất SQL bằng phpMyAdmin và sao lưu `storage/app/private`, `.env`. Thử phục hồi vào database và thư mục thử riêng.
- Cấu hình APP_ENV=production, APP_DEBUG=false, APP_URL theo tên miền HTTPS khi triển khai.
- Cấu hình SMTP thật để gửi email đặt lại mật khẩu. Kiểm thử từ yêu cầu khôi phục tới đăng nhập lại.
- Cấu hình reverse proxy WebSocket và tiến trình Reverb tự khởi động lại. Kiểm tra chat bằng hai trình duyệt qua tên miền thực tế.
- Mã nguồn hiện đã kiểm thử nghiệp vụ bằng SQLite. Môi trường hiện tại chưa có MySQL/MariaDB khả dụng, nên cần chạy lại `php artisan test` trên database thử MySQL riêng bằng cấu hình kiểm thử của bạn. Database kiểm thử phải tách khỏi database đang dùng vì các bài test dùng RefreshDatabase.

