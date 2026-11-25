# HeyDay — Tổng kết triển khai

HeyDay là đồ án web chat tiếng Việt dùng Laravel 12 cho backend, React và Vite cho giao diện, cùng Laravel Reverb và Laravel Echo để đồng bộ qua WebSocket. Giao diện có bố cục dành cho máy tính và điện thoại.

## Tính năng đã triển khai

| Phần | Chức năng |
| --- | --- |
| Tài khoản | Đăng ký, đăng nhập bằng email hoặc tên đăng nhập, đăng xuất, đổi tên hiển thị và cập nhật ảnh đại diện |
| Bạn bè | Tìm theo tên hoặc `@username`, gửi và thu hồi lời mời, chấp nhận hoặc từ chối, hủy kết bạn và mở chat riêng từ danh sách bạn bè |
| Phòng chat | Chat 1–1 và chat nhóm, tìm và lọc phòng, xem danh sách thành viên. Người tạo nhóm có thể thêm thành viên |
| Tin nhắn | Gửi và nhận tin realtime, tải lịch sử theo từng trang tối đa 50 tin, sửa hoặc xóa tin của mình với mọi thành viên trong phòng |
| Ảnh | Chọn, thu phóng và căn vùng cắt cho ảnh đại diện. Trong chat, có thể gửi ảnh JPG, PNG hoặc WebP tối đa 5 MB, cắt vuông trước khi gửi và bấm ảnh để xem lớn |
| Thông báo và chuyển động | Cảnh báo ảnh sai định dạng, vượt giới hạn hoặc tải lên thất bại hiện trong hộp thoại có nút **Đã hiểu**. Hộp thoại, ảnh đính kèm và tin mới có hiệu ứng ngắn theo cài đặt giảm chuyển động của thiết bị |

Giao diện đăng nhập, chat và Bạn bè được chỉnh theo Unslop. Nền trung tính và chữ lớn hơn giúp đọc hội thoại dễ hơn. Xanh rêu đánh dấu phòng đang chọn và các thao tác chính. Ảnh nhóm bạn trên màn hình đăng nhập là ảnh của Duy Pham. [Unslop](https://github.com/heydamir/unslop) · [Ảnh trên Unsplash](https://unsplash.com/photos/people-holding-shoulders-sitting-on-wall-Cecb0_8Hx-o)

## Dữ liệu và phân quyền

- Bản chạy thử dùng SQLite. Bốn bảng chat từ thiết kế ban đầu gồm `users`, `rooms`, `room_members` và `messages`. Migration bổ sung bảng `friendships` và các cột phục vụ ảnh đại diện, ảnh đính kèm, sửa và xóa tin. [Thư mục migration](database/migrations)
- Mật khẩu được băm. Laravel xác thực bằng phiên đăng nhập và bảo vệ các yêu cầu thay đổi dữ liệu bằng CSRF. [Tuyến API](routes/web.php)
- Chỉ thành viên phòng mới xem lịch sử, gửi tin và mở ảnh đính kèm. Ảnh được lưu riêng trong `storage/app/private`. Chỉ người gửi được sửa hoặc xóa tin của mình. [ChatController](app/Http/Controllers/ChatController.php)
- WebSocket dùng kênh riêng theo tài khoản để cập nhật tin nhắn và lời mời. Khi mất kết nối, giao diện định kỳ đọc lại danh sách phòng, lời mời và lịch sử mới nhất của phòng đang mở. [Phân quyền kênh](routes/channels.php) · [Giao diện React](resources/js/app.jsx)
- Có hướng dẫn cấu hình MySQL/MariaDB. Các bài kiểm thử và bản chạy thử được thực hiện trên SQLite. [README](README.md)

## Chạy và trình diễn

Nếu dự án đã được cài đặt, chạy hai lệnh cập nhật sau. Các bước cài lần đầu có trong [README](README.md).

```powershell
php artisan migrate
npm.cmd run build
```

Mở hai cửa sổ PowerShell trong thư mục dự án. Chạy Laravel ở cửa sổ đầu và Reverb ở cửa sổ thứ hai.

```powershell
php artisan serve --host=127.0.0.1 --port=8000
```

```powershell
php artisan reverb:start --host=127.0.0.1 --port=8080
```

1. Mở [HeyDay](http://127.0.0.1:8000/) trong một cửa sổ thường và một cửa sổ ẩn danh. Chọn tài khoản demo **Dương** và **Linh** nếu dữ liệu mẫu đã được nạp.
2. Vào cùng phòng **Đồ án Web Chat**. Gửi một tin hoặc ảnh ở một bên, sau đó dùng biểu tượng bút để sửa hoặc xóa tin. Quan sát thay đổi ở phiên còn lại.
3. Mở **Bạn bè → Tìm bạn**. Gửi lời mời từ một bên và chấp nhận trong tab **Lời mời** ở bên còn lại. Mở chat từ danh sách bạn bè.
4. Bấm tài khoản ở góc dưới để chọn và cắt ảnh đại diện. Thử chọn một tệp sai định dạng hoặc ảnh vượt 5 MB để xem hộp thoại **Đã hiểu**.

## Kết quả kiểm thử

- `php artisan test` chạy thành công **16 bài kiểm thử**, với 210 xác nhận. Các bài kiểm thử bao gồm đăng ký và đăng nhập, quyền truy cập phòng, phân trang, kết bạn, quyền tải ảnh và quyền sửa hoặc xóa tin.
- `npm.cmd run build` chạy thành công sau khi cập nhật modal cảnh báo.
- Kiểm tra trên hai phiên Chromium xác nhận tin nhắn và lời mời đến qua WebSocket, đồng thời đồng bộ nội dung tin sau khi sửa hoặc xóa.
- Kiểm tra trên giao diện mobile xác nhận cắt và xem ảnh, hỗ trợ giảm chuyển động, mở và đóng modal bằng nút **Đã hiểu** hoặc phím Escape, giữ bản nháp và chọn ảnh lại.

## Hoàn thiện tài khoản

Đã bổ sung đổi mật khẩu và khôi phục qua email bằng liên kết có hạn 60 phút, dùng một lần. Sau khi đổi hoặc đặt lại mật khẩu, phiên cũ hết hiệu lực và ngừng nhận dữ liệu qua kênh realtime. Bản local dùng mail log; máy chủ triển khai cần cấu hình SMTP thật.

Đã kiểm tra trên trình duyệt luồng đổi mật khẩu, thu hồi phiên thứ hai, tiếp tục chat trên phiên hiện tại và khôi phục bằng liên kết email rồi đăng nhập lại trên mobile.