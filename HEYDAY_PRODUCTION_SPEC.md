# HeyDay — Đặc tả kỹ thuật toàn diện

HeyDay là ứng dụng web chat tiếng Việt thời gian thực cho máy tính và điện thoại. Stack gồm Laravel 12, React, Vite, Laravel Reverb và Laravel Echo. SQLite dùng cho phát triển và kiểm thử. MySQL/MariaDB là cơ sở dữ liệu mục tiêu cho production.

Giao diện theo Unslop, với nền trung tính, chữ dễ đọc trong hội thoại và xanh rêu cho phòng đang chọn cùng thao tác chính. Các hiệu ứng chuyển động tôn trọng `prefers-reduced-motion`.

Tài liệu mô tả yêu cầu của bản production. Bảng ở cuối ghi tình trạng so với mã nguồn hiện tại. Xem [tổng kết triển khai](HEYDAY_TONG_KET.md) để biết các tính năng đã được kiểm thử.

## 1. Tài khoản, hồ sơ và bạn bè

- Đăng ký, đăng nhập bằng email hoặc `@username`, đăng xuất. Băm mật khẩu, xác thực qua session và bảo vệ yêu cầu thay đổi dữ liệu bằng CSRF.
- Đổi tên hiển thị. Chọn, thu phóng và căn vùng cắt vuông cho ảnh đại diện.
- Tìm người dùng theo tên hoặc `@username`. Gửi, thu hồi, chấp nhận hoặc từ chối lời mời. Hủy kết bạn và mở chat riêng từ danh sách bạn bè.
- Chặn và bỏ chặn người dùng. Khi có chặn giữa hai tài khoản, ngăn nhắn tin 1–1 và gửi lời mời kết bạn, đồng thời ẩn tài khoản liên quan khỏi kết quả tìm kiếm.

## 2. Phòng chat và quản trị nhóm

- Hỗ trợ chat 1–1 và chat nhóm, tìm kiếm và lọc danh sách phòng.
- Trưởng nhóm có quyền thêm hoặc xóa thành viên, đổi tên nhóm và chuyển quyền trưởng nhóm.
- Thành viên có thể xem danh sách thành viên và chủ động rời nhóm qua hộp thoại xác nhận.

## 3. Nhắn tin và tương tác realtime

- Gửi và nhận tin qua kênh WebSocket riêng. Tự động tải 50 tin cũ hơn khi cuộn đến đầu khung chat và giữ vị trí đang đọc.
- Người gửi sửa hoặc xóa tin của mình. Thay đổi đồng bộ ngay cho các thành viên trong phòng.
- Trả lời bằng cách trích dẫn một tin cụ thể. Thả và gỡ các cảm xúc 👍, ❤️, 😂, 😮, 😢 trên tin nhắn.
- Hiện chấm trực tuyến hoặc thời điểm hoạt động gần nhất. Dùng Laravel Reverb Presence Channel cho trạng thái trực tuyến.
- Hiện chỉ báo **Đang soạn tin…** qua sự kiện `whisper` của Laravel Echo.
- Lưu `last_read_at` theo thành viên và phòng. Hiển thị số tin chưa đọc trong danh sách phòng và trạng thái **Đã xem** trong chat 1–1.
- Tìm theo từ khóa trong nội dung hội thoại đang mở.
- Tự lưu bản nháp theo phòng. Đọc lại danh sách phòng, lời mời và lịch sử mới nhất khi WebSocket gián đoạn hoặc kết nối lại.

## 4. Ảnh và lưu trữ

- Chấp nhận JPG, PNG và WebP tối đa 5 MB. Bắt buộc cắt vuông ảnh trước khi gửi trong chat. Bấm ảnh để mở hộp thoại xem lớn.
- Tạo thumbnail cho luồng chat. Tải ảnh đầy đủ khi mở hộp thoại xem lớn.
- Lưu ảnh đính kèm trong `storage/app/private`. Kiểm tra quyền thành viên qua controller khi truy xuất ảnh, bao gồm cả thumbnail.

## 5. Cảnh báo, thông báo và PWA

- Hiển thị lỗi định dạng ảnh, vượt 5 MB, vượt giới hạn tần suất và tải lên thất bại trong modal có nút **Đã hiểu**. Hỗ trợ đóng bằng phím Escape.
- Phát âm thanh khi có tin mới trong lúc tab đang ẩn. Có nút bật hoặc tắt tiếng. Hiện thông báo trình duyệt qua Web Notification API khi người dùng cấp quyền.
- Thêm `manifest.json`, icon xanh rêu và Service Worker để cài HeyDay lên màn hình chính trên thiết bị hỗ trợ.

## 6. Cơ sở dữ liệu, bảo mật và hiệu năng

- Các bảng mục tiêu gồm `users`, `rooms`, `room_members` với `role` và `last_read_at`, `messages` với `reply_to_id`, dữ liệu sửa hoặc xóa và ảnh đính kèm, `message_reactions`, cùng dữ liệu kết bạn và chặn.
- Dùng chỉ mục `messages (room_id, id)` và `room_members (user_id, room_id)`.
- Giới hạn theo tài khoản ở mức 30 tin nhắn mỗi phút và 10 ảnh tải lên mỗi phút.

## 7. Vận hành và kiểm thử

Sau khi cập nhật mã nguồn, chạy các lệnh sau trong thư mục dự án.

```powershell
php artisan migrate
npm.cmd run build
php artisan test
```

Xem cách khởi động Laravel và Reverb trong [README](README.md). Trước khi đưa vào production, kiểm thử migration và phân quyền trên MySQL/MariaDB, các giới hạn tần suất, luồng realtime qua hai phiên và trải nghiệm cài PWA trên thiết bị hỗ trợ.

## Tình trạng triển khai

Bản local đã bổ sung đăng nhập với tiền tố @, chặn và bỏ chặn, quản trị nhóm, trích dẫn, cảm xúc, trạng thái đã xem, số tin chưa đọc, tìm nội dung trong phòng, lưu nháp, tải lịch sử khi cuộn lên, ảnh thu nhỏ, giới hạn gửi và PWA.

- Quản trị nhóm gồm đổi tên, xóa thành viên, chuyển quyền và rời nhóm qua modal xác nhận. Trưởng nhóm cần chuyển quyền trước khi rời nhóm còn thành viên khác.
- Trạng thái trực tuyến dùng Presence Channel khi đang xem phòng; heartbeat lưu thời điểm hoạt động gần nhất. Chỉ báo đang soạn dùng whisper có danh tính từ kênh xác thực.
- Người dùng chọn ảnh trong chat phải cắt vuông trước khi gửi. Luồng chat dùng thumbnail tối đa 320 pixel, hộp thoại xem ảnh dùng bản đầy đủ. PHP cần GD hỗ trợ định dạng ảnh tương ứng hoặc FFmpeg để tạo thumbnail.
- Giới hạn gửi áp dụng theo tài khoản ở mức 30 tin/phút và 10 ảnh/phút. Các lỗi vượt giới hạn khi gửi tin hiện trong modal.
- Có manifest, icon, Service Worker và điều khiển âm thanh/thông báo. Thông báo khi tab ẩn yêu cầu người dùng cấp quyền và cửa sổ ứng dụng còn chạy.
- Kiểm thử backend và bản chạy local dùng SQLite. MySQL/MariaDB và triển khai HTTPS lên máy chủ production chưa được kiểm thử trong môi trường hiện tại.
- Phạm vi triển khai theo các mục 1–7 của tài liệu này. Gọi thoại/video và chia sẻ màn hình cần phần triển khai tiếp theo.

Bộ kiểm thử Laravel đạt 16 bài với 210 xác nhận. Vite build thành công. Kiểm tra trình duyệt hai phiên đã xác nhận chỉ báo đang soạn, lưu nháp sau tải lại, trả lời trích dẫn và thả cảm xúc.
Kiểm tra bổ sung trên hai phiên trình duyệt xác nhận đổi tên nhóm realtime, trạng thái đã xem trong chat riêng, chặn và bỏ chặn, bố cục mobile, tải JPG đã cắt, thumbnail 320 pixel và ảnh đầy đủ 1024 pixel.

Cập nhật hoàn thiện tài khoản bổ sung đổi mật khẩu và khôi phục qua email. Mỗi liên kết khôi phục chỉ dùng một lần, hạn 60 phút. Phiên bản xác thực tăng sau khi đổi mật khẩu; middleware từ chối phiên cũ và các sự kiện realtime chuyển sang kênh tài khoản phiên bản mới. Mật khẩu hiện tại bắt buộc khi đổi từ phiên đã đăng nhập. Yêu cầu khôi phục trả thông báo chung cho cả email tồn tại và email chưa đăng ký.