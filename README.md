# HeyDay

Ứng dụng chat thời gian thực bằng Laravel 12, React và Laravel Reverb. Giao diện tiếng Việt hỗ trợ máy tính và điện thoại.

## Chạy tại máy

Cần PHP 8.4 trở lên có driver PDO MySQL, Composer, Node.js 22.12 trở lên và MySQL/MariaDB. Tạo database và điền cấu hình trước khi chạy migrate theo [hướng dẫn phpMyAdmin](MYSQL_PHPMyAdmin.md).

```powershell
composer install
Copy-Item .env.mysql.example .env
php artisan key:generate
php artisan reverb:install --no-interaction
New-Item database/database.sqlite -ItemType File
php artisan migrate --seed
npm.cmd ci
npm.cmd run build
```

Các lệnh sao chép cấu hình, tạo khóa và tạo tệp SQLite chỉ cần chạy khi cài mới. Sau đó mở hai cửa sổ PowerShell:

```powershell
php artisan serve --host=127.0.0.1 --port=8000
```

```powershell
php artisan reverb:start --host=127.0.0.1 --port=8080
```

Mở [HeyDay](http://127.0.0.1:8000). Để thử realtime, dùng hai cửa sổ trình duyệt với cookie riêng (ví dụ một cửa sổ thường và một cửa sổ ẩn danh). Chọn **Dương** ở cửa sổ đầu, **Linh** ở cửa sổ thứ hai, mở cùng phòng **Đồ án Web Chat** rồi gửi tin ở một bên. Trạng thái **Đã kết nối realtime** xuất hiện trong bảng thông tin phòng sau khi đăng ký kênh thành công.

Khi sửa mã giao diện, chạy thêm `npm.cmd run dev` để Vite tải lại thay đổi. Có thể dùng `composer dev` để khởi động đồng thời Laravel, Reverb và Vite.

## Cơ sở dữ liệu

Migration tạo bốn bảng chat `users`, `rooms`, `room_members` và `messages` cùng bảng `friendships` cho tính năng kết bạn. Với bản đã cài, chạy `php artisan migrate` để thêm bảng mới. Lịch sử trả về tối đa 50 tin nhắn mỗi trang, với con trỏ theo ID tin nhắn. Mỗi cặp người dùng chỉ có một phòng chat riêng. Người tạo nhóm có quyền mời thêm thành viên.

Mở **Bạn bè → Tìm bạn** để tìm theo tên hoặc tên đăng nhập và gửi lời mời. Người nhận có thể chấp nhận hoặc từ chối trong tab **Lời mời**. Sau khi chấp nhận, cả hai có thể mở chat riêng ngay từ danh sách bạn bè.

## Ảnh và chỉnh sửa tin nhắn

- Bấm tên tài khoản ở góc dưới để đổi tên hiển thị, chọn và cắt ảnh đại diện.
- Bấm biểu tượng ảnh cạnh ô soạn tin để đính kèm JPG, PNG hoặc WebP tối đa 5 MB. Ảnh được cắt vuông trước khi gửi, với tùy chọn thu phóng và căn vùng cắt. Bấm ảnh đã gửi để xem kích thước lớn.
- Dùng biểu tượng bút cạnh tin của mình để sửa nội dung hoặc xóa với mọi thành viên trong phòng. Ảnh đính kèm được lưu riêng trong `storage/app/private` và chỉ thành viên phòng truy cập được.
- Với bản đã cài, chạy `php artisan migrate` và `npm.cmd run build` sau khi cập nhật mã nguồn. Khi cấu hình PHP giới hạn tải lên thấp hơn 5 MB, điều chỉnh `upload_max_filesize` và `post_max_size` tương ứng.

Hướng dẫn MySQL/MariaDB và phpMyAdmin, cách tạo database và khởi tạo quản trị viên có trong [MYSQL_PHPMyAdmin.md](MYSQL_PHPMyAdmin.md).

## Kiểm thử

```powershell
php artisan test
npm.cmd run build
```

- Phiên đăng nhập sử dụng cookie và các yêu cầu thay đổi dữ liệu được bảo vệ bằng CSRF.
- WebSocket sử dụng kênh riêng theo tài khoản. Laravel kiểm tra thành viên phòng trước khi đọc hoặc gửi tin, sau đó chỉ phát sự kiện cho thành viên.
- Khi WebSocket ngắt, giao diện đọc lại danh sách phòng và lịch sử mới nhất định kỳ.
- Ảnh trang đăng nhập của [Duy Pham trên Unsplash](https://unsplash.com/photos/people-holding-shoulders-sitting-on-wall-Cecb0_8Hx-o).
- Giao diện được rà soát theo [Unslop của Damir Sokolovsky](https://github.com/heydamir/unslop).

## Các tính năng nâng cấp

- Trả lời trích dẫn, thả/gỡ cảm xúc, trạng thái đã xem và số tin chưa đọc.
- Lưu nháp theo tài khoản và phòng, tìm nội dung trong phòng, tải tin cũ khi cuộn lên.
- Chặn hoặc bỏ chặn người dùng. Trưởng nhóm đổi tên, xóa thành viên, chuyển quyền; thành viên rời nhóm qua xác nhận.
- Trạng thái đang soạn, trực tuyến trong phòng và thời điểm hoạt động gần nhất.
- Giới hạn 30 tin/phút và 10 ảnh/phút theo tài khoản. Thumbnail riêng tối đa 320 pixel; ảnh gốc chỉ mở khi xem lớn.
- PWA và các nút thông báo, âm thanh. Thông báo tab ẩn cần cấp quyền và cửa sổ ứng dụng còn chạy. Service Worker không lưu dữ liệu chat vào cache.
- Tạo thumbnail cần GD hỗ trợ JPG/PNG/WebP hoặc FFmpeg trên PATH. Môi trường đã kiểm tra có FFmpeg.
- Kiểm thử hiện tại dùng SQLite. MySQL/MariaDB và cấu hình HTTPS/Reverb trên máy chủ production cần được xác minh khi triển khai.

Xem chi tiết trong [đặc tả và tình trạng triển khai](HEYDAY_PRODUCTION_SPEC.md).
## Giao diện HeyDay

Bản thiết kế dùng GSAP cho lần mở giao diện và modal, với nhịp chuyển động 120/240/480 ms và hỗ trợ giảm chuyển động. Các panel, kiểu chữ, modal và hai giao diện Ngày/Đêm dùng chung một hệ thống màu và khoảng cách.

- Bấm biểu tượng tùy chỉnh để đổi giao diện Ngày/Đêm, mật độ hội thoại và cỡ chữ.
- Bấm ngôi sao trên đầu hội thoại để thêm hoặc bỏ phòng yêu thích. Thanh điều hướng trên máy tính và nút sao ở danh sách trên điện thoại mở danh sách này.
- Dùng Ctrl+K hoặc Command+K để chuyển nhanh giữa các phòng, phím mũi tên để chọn và Enter để mở.
- Bảng thông tin phòng có mục Ảnh đã chia sẻ lấy từ phần lịch sử đang tải. Dùng nút Tải thêm lịch sử để lấy thêm ảnh cũ.
- Tùy chọn và danh sách yêu thích được lưu theo tài khoản trên trình duyệt hiện tại.
## Tài khoản và khôi phục mật khẩu

- Trong Tùy chỉnh giao diện, chọn Đổi mật khẩu. Nhập mật khẩu hiện tại và xác nhận mật khẩu mới.
- Tại trang đăng nhập, chọn Quên mật khẩu để yêu cầu liên kết qua email. Liên kết hết hạn sau 60 phút và chỉ dùng một lần.
- Sau khi đổi hoặc đặt lại mật khẩu, các phiên khác hết hiệu lực. Kênh realtime cũng đổi phiên bản để phiên cũ ngừng nhận tin.
- Mật khẩu có ít nhất 8 ký tự và tối đa 72 byte.

Ở môi trường local, MAIL_MAILER=log ghi email thử vào log của ứng dụng. Khi triển khai lên máy chủ, cấu hình MAIL_MAILER=smtp, MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS và APP_URL bằng địa chỉ HTTPS của ứng dụng. Sau khi thay đổi cấu hình, chạy php artisan config:clear và khởi động lại Reverb. Kiểm tra gửi email thực tế trước khi sử dụng luồng khôi phục với người dùng.

## Nghiệm thu đồ án

Bộ kiểm thử hiện tại có 16 bài với 210 xác nhận. Kiểm thử gồm tài khoản, token khôi phục một lần và hết hạn, thu hồi phiên, thay phiên bản kênh realtime, phân quyền phòng/ảnh/tin nhắn, kết bạn/chặn và quản trị nhóm. Bản React build thành công.

Kịch bản trình diễn gồm hai cửa sổ có cookie riêng. Dùng Dương và Linh để gửi tin/ảnh, trích dẫn, thả cảm xúc, xem số chưa đọc và trạng thái đã xem; tạo nhóm, đổi tên/chuyển quyền/rời nhóm; kết bạn, chặn và bỏ chặn. Dùng tài khoản thử riêng để kiểm tra đổi và khôi phục mật khẩu.

Môi trường đã kiểm thử dùng SQLite và Chromium. MySQL/MariaDB, SMTP thật, HTTPS và cấu hình reverse proxy WebSocket cần được xác minh tại máy chủ triển khai. Gọi thoại/video và chia sẻ màn hình còn nằm ngoài các luồng đã triển khai.
## Quản trị và kiểm duyệt

Có bảng quản trị tài khoản, phân quyền, khóa/mở khóa, xử lý báo cáo tin nhắn và nhật ký thao tác. Khởi tạo quyền bằng lệnh heyday:admin theo hướng dẫn MySQL/phpMyAdmin. Mọi tài khoản mới đăng ký mặc định là thành viên.
